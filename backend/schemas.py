"""Public request constraints; data-dependent checks live in analysis services."""

from pydantic import BaseModel, ConfigDict, Field


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class SampleRequest(RequestModel):
    name: str = Field(min_length=1, max_length=80)
    rows: int | None = Field(default=None, ge=30, le=25000)


class DatasetRequest(RequestModel):
    datasetId: str = Field(min_length=1, max_length=128)


class ForecastRequest(DatasetRequest):
    target: str = Field(min_length=1, max_length=200)
    dateColumn: str | None = Field(default=None, max_length=200)
    periods: int = Field(default=30, ge=1, le=365)
    period: int | None = Field(default=None, ge=0, le=365)


class ClusterRequest(DatasetRequest):
    features: list[str] = Field(min_length=2, max_length=20)
    clusters: int = Field(default=3, ge=2, le=10)


class ClassifyRequest(DatasetRequest):
    features: list[str] = Field(min_length=1, max_length=20)
    target: str = Field(min_length=1, max_length=200)
    testSize: float = Field(default=0.25, ge=0.1, le=0.4)


class InsightsRequest(DatasetRequest):
    threshold: float = Field(default=3.0, ge=2, le=6)
