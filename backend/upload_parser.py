"""Single-file multipart parsing with bounded in-memory metadata and spooling."""

from fastapi import HTTPException
from starlette.formparsers import MultiPartException, MultiPartParser


class SingleFileParser(MultiPartParser):
    spool_max_size = 128 * 1024

    def on_part_begin(self):
        self._header_bytes = 0
        self._header_limit_hit = False
        super().on_part_begin()

    def _count_header(self, start, end):
        self._header_bytes += end - start
        if self._header_bytes > 4 * 1024:
            self._header_limit_hit = True
            raise HTTPException(
                413,
                "Multipart headers are too large. Use a shorter filename and ordinary upload metadata.",
            )

    def on_header_field(self, data, start, end):
        self._count_header(start, end)
        super().on_header_field(data, start, end)

    def on_header_value(self, data, start, end):
        self._count_header(start, end)
        super().on_header_value(data, start, end)

    async def parse(self):
        try:
            return await super().parse()
        except BaseException:
            # Includes disconnect/cancellation and our own header guard, not only
            # the MultiPartException path cleaned by Starlette itself.
            for file in self._files_to_close_on_error:
                file.close()
            if getattr(self, "_header_limit_hit", False):
                raise HTTPException(
                    413,
                    "Multipart headers are too large. Use ordinary upload metadata.",
                ) from None
            raise


async def parse_upload(request):
    content_type = request.headers.get("content-type", "")
    if len(content_type) > 1024:
        raise HTTPException(413, "Upload content-type metadata is too large.")
    if not content_type.lower().startswith("multipart/form-data;"):
        raise HTTPException(400, "Upload one file using multipart/form-data.")
    parser = SingleFileParser(
        request.headers,
        request.stream(),
        max_files=1,
        max_fields=0,
        max_part_size=65536,
    )
    try:
        return await parser.parse()
    except MultiPartException:
        raise HTTPException(
            400,
            "Upload exactly one file in the file field, without additional fields or files.",
        ) from None
