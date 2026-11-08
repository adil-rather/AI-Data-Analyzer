import pandas as pd
from dataset_engine import TableData
from schemas import ClusterRequest


def test_model_materializes_only_required_columns():
    table = TableData.from_frame(
        pd.DataFrame({"a": [1, 2, 3], "b": [2, 3, 4], "large_text": ["x" * 8000] * 3}),
        "fixture",
    )
    try:
        frame, _ = table.model_frame(
            "cluster",
            ClusterRequest(datasetId="fixture", features=["a", "b"], clusters=2),
        )
        assert list(frame.columns) == ["a", "b"]
    finally:
        table.close()
