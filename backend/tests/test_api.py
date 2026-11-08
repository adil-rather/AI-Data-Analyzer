import io
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pandas as pd
from fastapi.testclient import TestClient

from conftest import upload_csv


def test_another_browser_cannot_access_dataset(app, client, retail):
    with TestClient(app, headers={"X-Requested-With": "AI-Data-Analyzer"}) as other:
        other.get("/api/session")
        response = other.post("/api/insights", json={"datasetId": retail["datasetId"]})
        assert response.status_code == 404


def test_session_restores_dataset(client, retail):
    response = client.get("/api/session")
    assert response.status_code == 200
    assert response.json()["profile"]["datasetId"] == retail["datasetId"]


def test_clear_invalidates_dataset(client, retail):
    assert client.delete("/api/dataset").status_code == 204
    assert client.get("/api/session").json()["profile"] is None
    assert (
        client.post(
            "/api/insights", json={"datasetId": retail["datasetId"]}
        ).status_code
        == 404
    )


def test_invalid_replacement_keeps_previous_dataset(client, retail):
    assert upload_csv(client, "").status_code == 400
    assert (
        client.get("/api/session").json()["profile"]["datasetId"] == retail["datasetId"]
    )


def test_readable_xlsx_upload(client):
    buffer = io.BytesIO()
    pd.DataFrame({"value": [1, 2, 3], "label": ["a", "b", "a"]}).to_excel(
        buffer, index=False
    )
    response = client.post(
        "/api/upload", files={"file": ("sample.xlsx", buffer.getvalue())}
    )
    assert response.status_code == 200
    assert response.json()["rows"] == 3
    assert response.json()["name"] == "sample.xlsx"


def test_unsupported_extension_rejected(client):
    assert upload_csv(client, "a,b\n1,2", "data.exe").status_code == 415


def test_duplicate_headers_rejected(client):
    response = upload_csv(client, "value,value\n1,2")
    assert response.status_code == 400
    assert "unique" in response.json()["detail"].lower()


def test_infinities_become_missing_profile_values(client):
    response = upload_csv(client, "value,label\n1,a\ninf,b\n-inf,c\n,d")
    assert response.status_code == 200
    profile = response.json()
    assert profile["stats"][0]["missing"] == 3
    assert profile["preview"][1]["value"] is None


def test_unknown_api_is_json_404(client):
    response = client.get("/api/not-a-real-route")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_mutation_requires_same_origin_header(app):
    with TestClient(app) as unsafe:
        response = unsafe.post("/api/sample", json={"name": "retail_sales"})
        assert response.status_code == 403


def test_cross_origin_mutation_rejected(client):
    response = client.post(
        "/api/sample",
        json={"name": "retail_sales"},
        headers={"Origin": "https://untrusted.example"},
    )
    assert response.status_code == 403


def test_profile_includes_real_histogram_and_median(client):
    response = upload_csv(client, "value\n1\n2\n3\n4\n5")
    assert response.status_code == 200
    stat = response.json()["stats"][0]
    assert stat["median"] == 3
    assert sum(item["count"] for item in stat["histogram"]) == 5


def test_oversized_json_rejected_before_parse(client):
    response = client.post(
        "/api/forecast",
        content=b"a" * (128 * 1024),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413


def test_large_csv_keeps_all_rows_and_labels_sampled_analysis(client):
    count = 1_000_001
    csv = "value,other\n" + "\n".join(f"{i},{i % 97}" for i in range(count))
    response = upload_csv(client, csv, "million-rows.csv")
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["rows"] == count
    assert result["stats"][0]["count"] == count
    analysis = client.post("/api/insights", json={"datasetId": result["datasetId"]})
    assert analysis.status_code == 200
    scope = analysis.json()["analysisScope"]
    assert scope["sourceRows"] == count
    assert scope["analyzedRows"] == 25000
    assert scope["method"] == "Deterministic reservoir sample"


def test_uploaded_rowid_does_not_replace_source_row_numbers(client):
    csv = "rowid,__row,value\n" + "\n".join(
        ["label,abc,100"] * 30 + ["label,abc,10000"]
    )
    uploaded = upload_csv(client, csv)
    assert uploaded.status_code == 200
    did = uploaded.json()["datasetId"]
    response = client.post("/api/insights", json={"datasetId": did})
    assert response.status_code == 200
    assert response.json()["anomalies"]["rows"][0]["row"] == 31


def test_preview_bounds_long_text_without_discarding_source(client):
    response = upload_csv(client, "text,value\n" + "x" * 8000 + ",1")
    assert response.status_code == 200
    assert len(response.json()["preview"][0]["text"]) <= 257
    assert response.json()["previewTextLimit"] == 256


def test_clear_cancels_a_pending_upload(client, retail, monkeypatch):
    from dataset_engine import TableData

    original = TableData.from_upload
    started, resume = Event(), Event()

    def blocked(stream, name):
        started.set()
        assert resume.wait(10)
        return original(stream, name)

    monkeypatch.setattr(TableData, "from_upload", blocked)
    with ThreadPoolExecutor(max_workers=1) as executor:
        pending = executor.submit(upload_csv, client, "value\n1\n2")
        try:
            assert started.wait(10)
            assert client.delete("/api/dataset").status_code == 204
        finally:
            resume.set()
        result = pending.result(timeout=15)
    assert result.status_code == 409
    assert client.get("/api/session").json()["profile"] is None
