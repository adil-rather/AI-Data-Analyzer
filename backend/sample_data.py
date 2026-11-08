"""Synthetic sample datasets for the AI Data Analyzer.

Each generator returns a pandas DataFrame with realistic trends, seasonality
and noise so the forecasting / clustering / classification demos look alive.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def _seed() -> np.random.Generator:
    return np.random.default_rng(42)


def retail_sales(n: int = 730) -> pd.DataFrame:
    """Daily retail sales with weekly + yearly seasonality and an upward trend."""
    rng = _seed()
    dates = pd.date_range("2022-01-01", periods=n, freq="D")
    t = np.arange(n)
    trend = 800 + 1.2 * t
    yearly = 250 * np.sin(2 * np.pi * t / 365.25)
    weekly = 120 * np.sin(2 * np.pi * t / 7)
    noise = rng.normal(0, 60, n)
    sales = trend + yearly + weekly + noise
    sales = np.clip(sales, 50, None)

    customers = sales * rng.normal(1.4, 0.05, n)
    marketing = 200 + 80 * np.sin(2 * np.pi * t / 30) + rng.normal(0, 25, n)
    region = rng.choice(["North", "South", "East", "West"], n, p=[0.3, 0.25, 0.2, 0.25])
    promo = rng.choice([0, 1], n, p=[0.8, 0.2])

    return pd.DataFrame(
        {
            "date": dates,
            "sales": np.round(sales, 1),
            "customers": np.round(customers).astype(int),
            "marketing_spend": np.round(marketing, 1),
            "region": region,
            "promo": promo,
        }
    )


def customer_segments(n: int = 600) -> pd.DataFrame:
    """Customer table with three well-separated latent segments.

    Each segment differs in *both* income and spending behaviour, so the
    K-Means clustering separates cleanly and a classifier can predict the
    segment label from the numeric features with high accuracy.
    """
    rng = _seed()
    kind = rng.choice(3, n, p=[0.4, 0.35, 0.25])
    label = np.where(kind == 0, "Budget", np.where(kind == 1, "Mid-Tier", "Premium"))

    income = np.where(
        kind == 0,
        rng.normal(38000, 8000, n),
        np.where(kind == 1, rng.normal(68000, 12000, n), rng.normal(120000, 22000, n)),
    )
    income = np.clip(income, 12000, None)

    spend = np.where(
        kind == 0,
        income * 0.05 + rng.normal(0, 400, n),
        np.where(
            kind == 1,
            income * 0.17 + rng.normal(0, 1500, n),
            income * 0.34 + rng.normal(0, 3500, n),
        ),
    )
    spend = np.clip(spend, 50, None)
    age = np.where(kind == 2, rng.normal(38, 10, n), rng.normal(48, 14, n)).clip(18, 90)
    tenure = np.where(kind == 2, rng.integers(20, 120, n), rng.integers(1, 80, n))
    gender = rng.choice(["M", "F"], n)

    return pd.DataFrame(
        {
            "age": np.round(age, 0).astype(int),
            "income": np.round(income).astype(int),
            "spending_score": np.round(spend, 1),
            "tenure_months": tenure,
            "gender": gender,
            "segment": label,
        }
    )


def sensor_telemetry(n: int = 1000) -> pd.DataFrame:
    """IoT sensor readings with drift, seasonality and injected anomalies."""
    rng = _seed()
    t = np.arange(n)
    temperature = 60 + 0.01 * t + 5 * np.sin(2 * np.pi * t / 50) + rng.normal(0, 1.5, n)
    vibration = 2 + 0.4 * np.sin(2 * np.pi * t / 20) + rng.normal(0, 0.3, n)
    pressure = 100 + 8 * np.sin(2 * np.pi * t / 120) + rng.normal(0, 2, n)
    # inject anomalies
    anomaly_idx = rng.choice(n, 25, replace=False)
    temperature[anomaly_idx] += rng.normal(25, 5, 25)
    vibration[anomaly_idx] += rng.normal(4, 1, 25)
    machine = rng.choice([f"M-{i}" for i in range(1, 6)], n)
    return pd.DataFrame(
        {
            "temperature": np.round(temperature, 2),
            "vibration": np.round(vibration, 3),
            "pressure": np.round(pressure, 2),
            "machine_id": machine,
        }
    )


def stock_prices(n: int = 500) -> pd.DataFrame:
    """Simulated daily OHLCV with a geometric random walk + drift."""
    rng = _seed()
    dates = pd.date_range("2023-01-01", periods=n, freq="B")
    returns = rng.normal(0.0008, 0.018, n)
    close = 100 * np.cumprod(1 + returns)
    open_ = np.concatenate([[100], close[:-1] * (1 + rng.normal(0, 0.005, n - 1))])
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.01, n)))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.01, n)))
    volume = rng.integers(1_000_000, 5_000_000, n)
    return pd.DataFrame(
        {
            "date": dates,
            "open": np.round(open_, 2),
            "high": np.round(high, 2),
            "low": np.round(low, 2),
            "close": np.round(close, 2),
            "volume": volume,
        }
    )


DATASETS: dict[str, callable] = {
    "retail_sales": retail_sales,
    "customer_segments": customer_segments,
    "sensor_telemetry": sensor_telemetry,
    "stock_prices": stock_prices,
}

DESCRIPTIONS: dict[str, str] = {
    "retail_sales": "730 days of retail sales with weekly & yearly seasonality — great for forecasting.",
    "customer_segments": "600 customers with latent spending archetypes — ideal for clustering.",
    "sensor_telemetry": "IoT sensor stream with injected anomalies — perfect for anomaly detection.",
    "stock_prices": "Simulated daily OHLCV stock prices — try forecasting the close.",
}


def list_samples() -> list[dict]:
    return [
        {"id": k, "name": k.replace("_", " ").title(), "description": DESCRIPTIONS[k]}
        for k in DATASETS
    ]


def get_sample(name: str, n: int | None = None) -> pd.DataFrame:
    gen = DATASETS[name]
    if n is not None:
        return gen(n)
    return gen()
