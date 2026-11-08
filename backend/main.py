"""Same-origin API and production SPA host. Start one worker from backend/."""

import asyncio
from contextlib import asynccontextmanager, suppress
import hashlib
import logging
from pathlib import Path
import re
import secrets
from threading import BoundedSemaphore
from urllib.parse import urlsplit
from fastapi import FastAPI, HTTPException, Request, Response
from starlette.datastructures import UploadFile
from starlette.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse
from threadpoolctl import threadpool_limits
import analysis
from sample_data import DATASETS, get_sample, list_samples
from schemas import (
    ClassifyRequest,
    ClusterRequest,
    ForecastRequest,
    InsightsRequest,
    SampleRequest,
)
from store import DatasetStore, TTL_SECONDS
from dataset_engine import TableData, capacity_check
import tempfile
from upload_parser import parse_upload

logger = logging.getLogger("analyzer")
COOKIE = "analyzer_session"
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


class BodyLimitMiddleware:
    """Bound received bytes before multipart parsing, including chunked bodies."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        upload = scope["path"] == "/api/upload"
        limit = None if upload else 65536
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = 65537
        if limit is not None and declared > limit:
            return await JSONResponse(
                {"detail": "Analysis settings are too large."}, status_code=413
            )(scope, receive, send)
        if upload:
            try:
                capacity_check(tempfile.gettempdir(), declared * 2)
            except HTTPException as exc:
                return await JSONResponse(
                    {"detail": exc.detail}, status_code=exc.status_code
                )(scope, receive, send)
        consumed = 0

        async def bounded_receive():
            nonlocal consumed
            message = await receive()
            consumed += len(message.get("body", b""))
            if limit is not None and consumed > limit:
                raise HTTPException(413, "Analysis settings are too large.")
            if upload:
                capacity_check(tempfile.gettempdir(), len(message.get("body", b"")) * 2)
            return message

        await self.app(scope, bounded_receive, send)


def create_app(store=None, dist=None):
    registry = store if store is not None else DatasetStore()
    build = Path(dist) if dist is not None else DIST
    jobs = BoundedSemaphore(2)

    @asynccontextmanager
    async def lifespan(_):
        async def cleanup():
            while True:
                await asyncio.sleep(60)
                registry.prune()

        task = asyncio.create_task(cleanup())
        yield
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        registry.close()

    api = FastAPI(title="AI Data Analyzer", version="2.0.0", lifespan=lifespan)
    api.add_middleware(BodyLimitMiddleware)

    @api.middleware("http")
    async def session_and_security(request: Request, call_next):
        if request.url.path.startswith("/api/") and request.method in {
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
        }:
            origin = request.headers.get("origin")
            expected = urlsplit(str(request.url))
            source = urlsplit(origin) if origin else None
            if (
                request.headers.get("X-Requested-With") != "AI-Data-Analyzer"
                or request.headers.get("sec-fetch-site") == "cross-site"
                or (
                    source
                    and (
                        source.netloc != expected.netloc
                        or source.scheme not in {"http", "https"}
                    )
                )
            ):
                return JSONResponse(
                    {"detail": "Use the analyzer from its own website to change data."},
                    status_code=403,
                )
        token = request.cookies.get(COOKIE, "")
        new = not re.fullmatch(r"[A-Za-z0-9_-]{43}", token)
        if new:
            token = secrets.token_urlsafe(32)
        request.state.owner = hashlib.sha256(token.encode()).hexdigest()
        work = (
            request.url.path
            in {
                "/api/sample",
                "/api/upload",
                "/api/forecast",
                "/api/cluster",
                "/api/classify",
                "/api/insights",
            }
            and request.method == "POST"
        )
        if work and not jobs.acquire(blocking=False):
            return JSONResponse(
                {"detail": "Two jobs are already running. Try again in a moment."},
                status_code=429,
            )
        writing = (
            request.url.path in {"/api/sample", "/api/upload"}
            and request.method == "POST"
        )
        lease = registry.begin_write(request.state.owner) if writing else None
        request.state.write_lease = lease
        try:
            response = await call_next(request)
        finally:
            if writing:
                registry.end_write(request.state.owner, lease)
            if work:
                jobs.release()
        if new and request.url.path.startswith("/api/"):
            response.set_cookie(
                COOKIE,
                token,
                max_age=86400,
                httponly=True,
                secure=request.url.scheme == "https",
                samesite="lax",
                path="/api",
            )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        )
        response.headers["Cache-Control"] = (
            "public, max-age=31536000, immutable"
            if request.url.path.startswith("/assets/") and response.status_code == 200
            else "no-store"
        )
        return response

    @api.exception_handler(Exception)
    async def unexpected(_, exc):
        logger.error("Analysis request failed (%s)", type(exc).__name__)
        return JSONResponse(
            {
                "detail": "The server could not complete this analysis. Check your data or try a smaller dataset."
            },
            status_code=500,
        )

    @api.get("/api/health")
    def health():
        return {"service": "AI Data Analyzer", "status": "ok", "version": "2.0.0"}

    @api.get("/api/session")
    def session(request: Request):
        item = registry.get(request.state.owner)
        return {
            "profile": item.profile if item else None,
            "expiresInSeconds": TTL_SECONDS,
        }

    @api.delete("/api/dataset", status_code=204)
    def clear(request: Request):
        registry.clear(request.state.owner)
        return Response(status_code=204)

    @api.get("/api/samples")
    def samples():
        return list_samples()

    @api.post("/api/sample")
    def sample(req: SampleRequest, request: Request):
        if req.name not in DATASETS:
            raise HTTPException(404, "Unknown sample dataset.")
        table = TableData.from_frame(
            get_sample(req.name, req.rows), req.name.replace("_", " ").title()
        )
        return registry.put(request.state.owner, table, request.state.write_lease)

    @api.post("/api/upload")
    async def upload(request: Request):
        form = await parse_upload(request)
        try:
            file = form.get("file")
            if not isinstance(file, UploadFile):
                raise HTTPException(
                    400, "Choose exactly one uploaded file in the file field."
                )
            name = (
                (file.filename or "dataset.csv").replace("\\", "/").split("/")[-1][:200]
            )
            table = await run_in_threadpool(TableData.from_upload, file.file, name)
            return registry.put(request.state.owner, table, request.state.write_lease)
        finally:
            await form.close()

    def run_model(fn, req, request):
        item = registry.get(request.state.owner, req.datasetId)
        with threadpool_limits(limits=1):
            frame, scope = item.table.model_frame(fn.__name__, req)
            return {**fn(frame, req), "analysisScope": scope}

    @api.post("/api/forecast")
    def forecast(req: ForecastRequest, request: Request):
        return run_model(analysis.forecast, req, request)

    @api.post("/api/cluster")
    def cluster(req: ClusterRequest, request: Request):
        return run_model(analysis.cluster, req, request)

    @api.post("/api/classify")
    def classify(req: ClassifyRequest, request: Request):
        return run_model(analysis.classify, req, request)

    @api.post("/api/insights")
    def insights(req: InsightsRequest, request: Request):
        return run_model(analysis.insights, req, request)

    @api.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(404, "API route not found.")
        root = build.resolve()
        candidate = (root / full_path).resolve()
        if not candidate.is_relative_to(root):
            raise HTTPException(404, "File not found.")
        if candidate.is_file():
            return FileResponse(candidate)
        if Path(full_path).suffix or full_path.startswith("assets/"):
            raise HTTPException(404, "File not found.")
        if (root / "index.html").is_file():
            return FileResponse(root / "index.html")
        raise HTTPException(
            404, "Frontend not built. Run npm ci and npm run build in frontend/."
        )

    return api


app = create_app()
