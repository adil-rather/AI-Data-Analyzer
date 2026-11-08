import pytest

from conftest import upload_csv


@pytest.mark.parametrize("horizon", [0, -1, 366])
def test_forecast_rejects_invalid_horizon(client, retail, horizon):
    response = client.post(
        "/api/forecast",
        json={"datasetId": retail["datasetId"], "target": "sales", "periods": horizon},
    )
    assert response.status_code == 422


def test_classifier_cannot_use_target_as_predictor(client):
    data = "target,value\n" + "\n".join(f"{i % 2},{i}" for i in range(40))
    did = upload_csv(client, data).json()["datasetId"]
    response = client.post(
        "/api/classify",
        json={"datasetId": did, "target": "target", "features": ["target"]},
    )
    assert response.status_code == 400
    assert "target" in response.json()["detail"].lower()


def test_cluster_k_must_be_below_complete_rows(client):
    did = upload_csv(client, "a,b\n1,2\n2,3\n3,4").json()["datasetId"]
    response = client.post(
        "/api/cluster", json={"datasetId": did, "features": ["a", "b"], "clusters": 3}
    )
    assert response.status_code == 400


def test_cluster_rejects_duplicate_features(client, retail):
    response = client.post(
        "/api/cluster",
        json={"datasetId": retail["datasetId"], "features": ["sales", "sales"]},
    )
    assert response.status_code == 400


def test_cluster_payload_preserves_coordinates_and_original_centroid_units(client):
    did = upload_csv(
        client, "x,y\n100,1000\n102,1020\n104,1040\n500,5000\n502,5020\n504,5040"
    ).json()["datasetId"]
    result = client.post(
        "/api/cluster", json={"datasetId": did, "features": ["x", "y"], "clusters": 2}
    ).json()
    assert "values" in result["points"][0]
    assert abs(result["points"][0]["x"]) < 5
    assert sorted(c["x"] for c in result["centroids"]) == pytest.approx([102, 502])


def test_forecast_uses_sorted_date_column(client):
    rows = [f"2024-01-{i:02},{i}" for i in range(20, 0, -1)]
    did = upload_csv(client, "date,value\n" + "\n".join(rows)).json()["datasetId"]
    response = client.post(
        "/api/forecast",
        json={"datasetId": did, "target": "value", "dateColumn": "date", "periods": 3},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["history"][0]["actual"] == 1
    assert result["future"][0]["date"].startswith("2024-01-21")
    assert result["evaluation"]["holdoutRows"] == 4
    assert result["evaluation"]["mae"] == pytest.approx(0, abs=1e-6)


def test_irregular_dates_explained_instead_of_silent_forecast(client):
    rows = [f"2024-01-{i:02},{i}" for i in [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13]]
    did = upload_csv(client, "date,value\n" + "\n".join(rows)).json()["datasetId"]
    response = client.post(
        "/api/forecast",
        json={"datasetId": did, "target": "value", "dateColumn": "date"},
    )
    assert response.status_code == 400
    assert "regular" in response.json()["detail"].lower()


def test_missing_targets_not_encoded_as_a_class(client):
    rows = [f"{i},{'A' if i % 2 else 'B'}" for i in range(40)] + ["41,"]
    did = upload_csv(client, "value,target\n" + "\n".join(rows)).json()["datasetId"]
    result = client.post(
        "/api/classify",
        json={"datasetId": did, "target": "target", "features": ["value"]},
    ).json()
    assert result["classes"] == ["A", "B"]
    assert result["trainSize"] + result["testSize"] == 40


def test_rare_class_returns_actionable_error(client):
    rows = [f"{i},A" for i in range(30)] + ["31,B"]
    did = upload_csv(client, "value,target\n" + "\n".join(rows)).json()["datasetId"]
    response = client.post(
        "/api/classify",
        json={"datasetId": did, "target": "target", "features": ["value"]},
    )
    assert response.status_code == 400
    assert "two" in response.json()["detail"].lower()


def test_holdout_must_actually_include_each_class(client):
    data = "value,target\n" + "\n".join(
        f"{i},{'A' if i < 98 else 'B'}" for i in range(100)
    )
    did = upload_csv(client, data).json()["datasetId"]
    response = client.post(
        "/api/classify",
        json={
            "datasetId": did,
            "target": "target",
            "features": ["value"],
            "testSize": 0.1,
        },
    )
    assert response.status_code == 400
    assert "holdout" in response.json()["detail"].lower()


def test_classifier_large_magnitudes_get_actionable_rescaling_error(client):
    data = "value,target\n" + "\n".join(f"{i * 1e40},{i % 2}" for i in range(100))
    did = upload_csv(client, data).json()["datasetId"]
    response = client.post(
        "/api/classify",
        json={"datasetId": did, "target": "target", "features": ["value"]},
    )
    assert response.status_code == 400
    assert "rescale" in response.json()["detail"].lower()


def test_forecast_preserves_small_nonzero_measurements(client):
    data = "value\n" + "\n".join(str((i + 1) * 1e-8) for i in range(20))
    did = upload_csv(client, data).json()["datasetId"]
    response = client.post(
        "/api/forecast",
        json={"datasetId": did, "target": "value", "period": 0, "periods": 3},
    )
    assert response.status_code == 200
    assert response.json()["future"][0]["forecast"] == pytest.approx(
        2.1e-7, rel=1e-6, abs=1e-15
    )


def test_missing_values_are_not_zero_anomalies(client):
    did = upload_csv(
        client, "value,label\n" + "\n".join(["100,a" for _ in range(30)] + [",b"])
    ).json()["datasetId"]
    response = client.post("/api/insights", json={"datasetId": did})
    assert response.status_code == 200
    result = response.json()
    assert result["anomalies"]["count"] == 0
    assert result["correlationMatrix"][0][0] is None


def test_anomaly_value_visible_even_after_eighth_column(client):
    columns = list("abcdefghi")
    csv = (
        ",".join(columns)
        + "\n"
        + "\n".join([",".join(["100"] * 9)] * 30 + [",".join(["100"] * 8 + ["10000"])])
    )
    did = upload_csv(client, csv).json()["datasetId"]
    result = client.post("/api/insights", json={"datasetId": did}).json()
    assert result["anomalies"]["rows"][0]["value"] == 10000


@pytest.mark.parametrize(
    "sample,endpoint,params",
    [
        (
            "retail_sales",
            "forecast",
            {"target": "sales", "dateColumn": "date", "periods": 14},
        ),
        (
            "customer_segments",
            "cluster",
            {"features": ["income", "spending_score", "age"], "clusters": 3},
        ),
        (
            "customer_segments",
            "classify",
            {"target": "segment", "features": ["income", "spending_score", "age"]},
        ),
        ("sensor_telemetry", "insights", {}),
        ("stock_prices", "forecast", {"target": "close", "dateColumn": "date"}),
    ],
)
def test_sample_analysis_workflows(client, sample, endpoint, params):
    did = client.post("/api/sample", json={"name": sample}).json()["datasetId"]
    response = client.post(f"/api/{endpoint}", json={"datasetId": did, **params})
    assert response.status_code == 200, response.text
