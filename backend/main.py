"""AI Data Analyzer — FastAPI backend.

Exposes a small ML toolkit over uploaded / sample tabular data:
  * dataset profiling (types, stats, preview)
  * trend forecasting (linear trend + FFT-detected seasonality)
  * K-Means clustering with PCA projection
  * classification (RandomForest) with metrics, confusion matrix, importances
  * insights (correlation matrix, key drivers, anomaly detection)
"""

from __future__ import annotations

import io
import json
import os
import warnings
from typing import Any, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sample_data import DATASETS, get_sample, list_samples

warnings.filterwarnings("ignore")

app = FastAPI(title="AI Data Analyzer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- in-memory dataset registry (process-local) -----------------------------
_STORE: dict[str, pd.DataFrame] = {}
_NEXT_ID = 1


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _column_type(series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    # try parsing as dates
    if series.dropna().iloc[: min(20, len(series.dropna()))].apply(
        lambda v: _looks_like_date(v)
    ).mean() > 0.8:
        return "datetime"
    n_unique = series.nunique(dropna=True)
    if n_unique <= max(20, int(0.2 * len(series.dropna()))):
        return "categorical"
    return "text"


def _looks_like_date(v: Any) -> bool:
    try:
        pd.to_datetime(str(v))
        return True
    except Exception:
        return False


def _profile(df: pd.DataFrame) -> dict:
    types = {c: _column_type(df[c]) for c in df.columns}
    stats = []
    for c in df.columns:
        col = df[c]
        if types[c] == "numeric":
            stats.append(
                {
                    "name": c,
                    "type": "numeric",
                    "count": int(col.notna().sum()),
                    "mean": _r(col.mean()),
                    "std": _r(col.std()),
                    "min": _r(col.min()),
                    "max": _r(col.max()),
                    "missing": int(col.isna().sum()),
                }
            )
        else:
            vc = col.value_counts().head(5)
            stats.append(
                {
                    "name": c,
                    "type": types[c],
                    "count": int(col.notna().sum()),
                    "unique": int(col.nunique()),
                    "top": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
                    "missing": int(col.isna().sum()),
                }
            )
    preview = json.loads(df.head(50).to_json(orient="records", date_format="iso"))
    return {
        "rows": int(len(df)),
        "columns": list(df.columns),
        "types": types,
        "stats": stats,
        "preview": preview,
    }


def _r(v: Any):
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        return float(round(v, 4))
    return v


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class SampleRequest(BaseModel):
    name: str
    rows: Optional[int] = None


class ForecastRequest(BaseModel):
    datasetId: str
    target: str
    dateColumn: Optional[str] = None
    periods: int = 30
    period: Optional[int] = None


class ClusterRequest(BaseModel):
    datasetId: str
    features: list[str]
    clusters: int = 3


class ClassifyRequest(BaseModel):
    datasetId: str
    features: list[str]
    target: str
    testSize: float = 0.25


class InsightsRequest(BaseModel):
    datasetId: str
    threshold: float = 3.0


# ---------------------------------------------------------------------------
# Dataset endpoints
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"service": "AI Data Analyzer", "status": "ok", "version": "1.0.0"}


@app.get("/api/samples")
def samples():
    return list_samples()


@app.post("/api/sample")
def load_sample(req: SampleRequest):
    if req.name not in DATASETS:
        raise HTTPException(404, "Unknown sample dataset")
    df = get_sample(req.name, req.rows)
    return _register(df)


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        if file.filename and file.filename.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(raw))
        else:
            df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Could not parse file: {e}")
    if df.empty:
        raise HTTPException(400, "Uploaded file contains no data")
    return _register(df)


def _register(df: pd.DataFrame) -> dict:
    global _NEXT_ID
    did = f"ds_{_NEXT_ID}"
    _NEXT_ID += 1
    _STORE[did] = df
    prof = _profile(df)
    prof["datasetId"] = did
    return prof


def _get(did: str) -> pd.DataFrame:
    if did not in _STORE:
        raise HTTPException(404, "Dataset not found (upload or load a sample first)")
    return _STORE[did]


# ---------------------------------------------------------------------------
# Forecasting
# ---------------------------------------------------------------------------
def _detect_period(resid: np.ndarray) -> Optional[int]:
    n = len(resid)
    if n < 12:
        return None
    detrended = resid - resid.mean()
    spec = np.abs(np.fft.rfft(detrended))
    freqs = np.fft.rfftfreq(n)
    # ignore the zero/very-low freq bins
    order = np.argsort(spec[1:])[::-1][:8] + 1
    for i in order:
        if freqs[i] <= 0:
            continue
        period = int(round(1.0 / freqs[i]))
        if 2 <= period <= max(2, n // 3):
            return period
    return None


@app.post("/api/forecast")
def forecast(req: ForecastRequest):
    df = _get(req.datasetId)
    if req.target not in df.columns:
        raise HTTPException(400, f"Target column '{req.target}' not found")
    series = pd.to_numeric(df[req.target], errors="coerce").dropna()
    if len(series) < 5:
        raise HTTPException(400, "Not enough numeric data to forecast")

    x = np.arange(len(series))
    y = series.values.astype(float)

    # linear trend
    coef = np.polyfit(x, y, 1)
    trend = np.polyval(coef, x)
    resid = y - trend

    period = req.period
    if period is None:
        period = _detect_period(resid)

    seasonal = np.zeros_like(y)
    seasonal_future = {}
    if period and period < len(y):
        # seasonal indices: average residual per phase
        idx = (x % period).astype(int)
        means = np.array([resid[idx == p].mean() if (idx == p).any() else 0.0
                          for p in range(period)])
        seasonal = means[idx]
        seasonal_future = {p: means[p] for p in range(period)}

    fitted = trend + seasonal
    resid_std = float(np.std(y - fitted)) or 1.0

    # forecast
    fx = np.arange(len(y), len(y) + req.periods)
    ftrend = np.polyval(coef, fx)
    fseason = np.array([seasonal_future.get(int(t % period), 0.0) if period else 0.0
                        for t in fx])
    fmean = ftrend + fseason
    lower = fmean - 1.96 * resid_std
    upper = fmean + 1.96 * resid_std

    history = [
        {"index": int(i), "actual": _r(y[i]), "fitted": _r(fitted[i])}
        for i in range(len(y))
    ]
    future = [
        {
            "index": int(fx[i]),
            "forecast": _r(fmean[i]),
            "lower": _r(lower[i]),
            "upper": _r(upper[i]),
        }
        for i in range(len(fx))
    ]

    # quality: R^2 on in-sample fit
    ss_res = float(np.sum((y - fitted) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "target": req.target,
        "period": period,
        "r2": _r(r2),
        "residualStd": _r(resid_std),
        "slope": _r(float(coef[0])),
        "history": history,
        "future": future,
        "summary": {
            "direction": "upward" if coef[0] > 0 else "downward",
            "avgChangePerStep": _r(float(coef[0])),
            "nextValue": _r(float(fmean[0])),
            "endValue": _r(float(fmean[-1])),
            "totalChange": _r(float(fmean[-1] - fmean[0])),
        },
    }


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------
@app.post("/api/cluster")
def cluster(req: ClusterRequest):
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import StandardScaler

    df = _get(req.datasetId)
    feats = [f for f in req.features if f in df.columns]
    if len(feats) < 2:
        raise HTTPException(400, "Select at least two numeric features")
    X = df[feats].apply(pd.to_numeric, errors="coerce").dropna()
    if len(X) < req.clusters:
        raise HTTPException(400, "Not enough complete rows for clustering")
    Xs = StandardScaler().fit_transform(X)

    km = KMeans(n_clusters=req.clusters, random_state=42, n_init=10)
    labels = km.fit_predict(Xs)

    if Xs.shape[1] > 2:
        coords = PCA(n_components=2).fit_transform(Xs)
    else:
        coords = Xs

    points = [
        {
            "x": _r(float(coords[i, 0])),
            "y": _r(float(coords[i, 1])),
            "cluster": int(labels[i]),
            **{f: _r(X.iloc[i][f]) for f in feats},
        }
        for i in range(len(X))
    ]
    centroids = [
        {f: _r(float(km.cluster_centers_[c][j])) for j, f in enumerate(feats)}
        for c in range(req.clusters)
    ]
    sil = float(silhouette_score(Xs, labels)) if len(set(labels)) > 1 else 0.0
    sizes = pd.Series(labels).value_counts().sort_index().to_dict()

    return {
        "features": feats,
        "clusters": req.clusters,
        "points": points,
        "centroids": centroids,
        "silhouette": _r(sil),
        "sizes": {str(k): int(v) for k, v in sizes.items()},
    }


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------
@app.post("/api/classify")
def classify(req: ClassifyRequest):
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import (
        accuracy_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
    )
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder

    df = _get(req.datasetId)
    feats = [f for f in req.features if f in df.columns]
    if req.target not in df.columns:
        raise HTTPException(400, f"Target '{req.target}' not found")
    if not feats:
        raise HTTPException(400, "Select at least one feature")

    X = df[feats].apply(pd.to_numeric, errors="coerce")
    y_raw = df[req.target]
    if pd.api.types.is_numeric_dtype(y_raw) and y_raw.nunique() > 10:
        raise HTTPException(400, "Target looks continuous; pick a categorical target")

    y = y_raw.astype(str)
    le = LabelEncoder()
    y_enc = le.fit_transform(y)
    mask = X.notna().all(axis=1) & y.notna().values
    X, y_enc = X[mask], y_enc[mask]
    if len(X) < 20:
        raise HTTPException(400, "Not enough complete rows")

    Xtr, Xte, ytr, yte = train_test_split(
        X, y_enc, test_size=req.testSize, random_state=42, stratify=y_enc
    )
    clf = RandomForestClassifier(n_estimators=120, random_state=42, n_jobs=-1)
    clf.fit(Xtr, ytr)
    pred = clf.predict(Xte)

    labels = list(le.classes_)
    cm = confusion_matrix(yte, pred, labels=range(len(labels)))
    importances = sorted(
        zip(feats, [float(v) for v in clf.feature_importances_]),
        key=lambda t: t[1],
        reverse=True,
    )

    return {
        "features": feats,
        "target": req.target,
        "classes": labels,
        "accuracy": _r(accuracy_score(yte, pred)),
        "precision": _r(precision_score(yte, pred, average="weighted", zero_division=0)),
        "recall": _r(recall_score(yte, pred, average="weighted", zero_division=0)),
        "f1": _r(f1_score(yte, pred, average="weighted", zero_division=0)),
        "trainSize": int(len(Xtr)),
        "testSize": int(len(Xte)),
        "confusionMatrix": cm.tolist(),
        "featureImportances": [{"feature": f, "importance": _r(v)} for f, v in importances],
    }


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------
@app.post("/api/insights")
def insights(req: InsightsRequest):
    df = _get(req.datasetId)
    numeric = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]

    # correlation matrix
    corr = df[numeric].corr() if numeric else pd.DataFrame()
    corr_matrix = (
        corr.round(3).fillna(0).values.tolist() if not corr.empty else []
    )

    # top correlated pairs
    pairs = []
    if len(numeric) >= 2:
        c = corr.abs()
        seen = set()
        for i in range(len(numeric)):
            for j in range(i + 1, len(numeric)):
                r = c.iloc[i, j]
                if not np.isnan(r):
                    key = tuple(sorted((numeric[i], numeric[j])))
                    if key in seen:
                        continue
                    seen.add(key)
                    pairs.append(
                        {
                            "a": numeric[i],
                            "b": numeric[j],
                            "correlation": _r(float(corr.iloc[i, j])),
                        }
                    )
        pairs.sort(key=lambda p: abs(p["correlation"]), reverse=True)
        pairs = pairs[:10]

    # anomalies (z-score across numeric columns)
    anomaly_rows = []
    if numeric:
        z = df[numeric].apply(pd.to_numeric, errors="coerce").fillna(0)
        z = (z - z.mean()) / (z.std().replace(0, 1))
        flags = (z.abs() > req.threshold).any(axis=1)
        idx = df.index[flags][:25]
        for i in idx:
            row = {c: _r(df.at[i, c]) for c in df.columns[:8]}
            worst = z.loc[i].abs().idxmax()
            row["_anomalyScore"] = _r(float(z.loc[i].abs().max()))
            row["_anomalyColumn"] = worst
            anomaly_rows.append(row)

    # per-column key stats (numeric)
    col_stats = []
    for c in numeric:
        col = pd.to_numeric(df[c], errors="coerce").dropna()
        col_stats.append(
            {
                "name": c,
                "mean": _r(col.mean()),
                "std": _r(col.std()),
                "min": _r(col.min()),
                "max": _r(col.max()),
                "skew": _r(float(col.skew())),
            }
        )

    return {
        "numericColumns": numeric,
        "correlationMatrix": corr_matrix,
        "topPairs": pairs,
        "anomalies": {"count": int(flags.sum()) if numeric else 0, "rows": anomaly_rows},
        "columnStats": col_stats,
    }


# ---------------------------------------------------------------------------
# Serve the built frontend (production single-server deploy)
# ---------------------------------------------------------------------------
# If frontend/dist exists (i.e. after `npm run build`), FastAPI also serves the
# compiled SPA so the whole app runs from ONE url/port. This is guarded by the
# dist-folder check, so local development (no build) is completely unaffected.
# Every /api and /docs route defined above is registered earlier and therefore
# takes precedence over this catch-all.
_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.isdir(_DIST):
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def _spa(full_path: str):
        candidate = os.path.join(_DIST, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_DIST, "index.html"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
