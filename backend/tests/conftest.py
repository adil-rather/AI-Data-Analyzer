import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


@pytest.fixture
def app():
    return main.create_app() if hasattr(main, "create_app") else main.app


@pytest.fixture
def client(app):
    with TestClient(app, headers={"X-Requested-With": "AI-Data-Analyzer"}) as session:
        session.get("/api/session")
        yield session


def upload_csv(client, text, name="test.csv"):
    return client.post("/api/upload", files={"file": (name, text.encode(), "text/csv")})


@pytest.fixture
def retail(client):
    response = client.post("/api/sample", json={"name": "retail_sales"})
    assert response.status_code == 200
    return response.json()
