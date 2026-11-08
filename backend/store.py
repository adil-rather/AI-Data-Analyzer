"""Opaque browser sessions own one expiring disk-backed table each."""

from dataclasses import dataclass
import secrets
from threading import RLock
import time
from fastapi import HTTPException

TTL_SECONDS = 60 * 60


@dataclass
class Dataset:
    id: str
    table: object
    profile: dict
    touched: float


class DatasetStore:
    def __init__(self, *, ttl=TTL_SECONDS, capacity=64, clock=time.monotonic):
        self.ttl, self.capacity, self.clock = ttl, capacity, clock
        self._items: dict[str, Dataset] = {}
        self._writes = {}
        self._lock = RLock()

    def _prune(self):
        now = self.clock()
        for owner in [
            key for key, item in self._items.items() if now - item.touched >= self.ttl
        ]:
            self._items.pop(owner).table.close()

    def prune(self):
        with self._lock:
            self._prune()

    def begin_write(self, owner):
        with self._lock:
            lease = object()
            self._writes[owner] = lease
            return lease

    def end_write(self, owner, lease):
        with self._lock:
            if self._writes.get(owner) is lease:
                self._writes.pop(owner, None)

    def put(self, owner, table, lease):
        with self._lock:
            if self._writes.get(owner) is not lease:
                table.close()
                raise HTTPException(
                    409,
                    "This upload was cancelled because the workspace was cleared or a newer upload started.",
                )
            self._prune()
            if owner not in self._items and len(self._items) >= self.capacity:
                table.close()
                raise HTTPException(
                    503,
                    "The server has reached its temporary session capacity. Try again later.",
                )
            did = secrets.token_urlsafe(24)
            profile = {**table.profile, "datasetId": did, "expiresInSeconds": self.ttl}
            previous = self._items.get(owner)
            self._items[owner] = Dataset(did, table, profile, self.clock())
            if previous:
                previous.table.close()
            return profile

    def get(self, owner, did=None):
        with self._lock:
            self._prune()
            item = self._items.get(owner)
            if item is None or (did is not None and item.id != did):
                if did is not None:
                    raise HTTPException(
                        404,
                        "Dataset unavailable. Your session may have expired; upload a file or load a sample again.",
                    )
                return None
            item.touched = self.clock()
            return item

    def clear(self, owner):
        with self._lock:
            self._writes.pop(owner, None)
            item = self._items.pop(owner, None)
            if item:
                item.table.close()

    def close(self):
        with self._lock:
            for item in self._items.values():
                item.table.close()
            self._items.clear()
            self._writes.clear()
