"""Deterministic exploratory models with explicit assumptions and bounded outputs."""

import math
from fastapi import HTTPException
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    silhouette_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from tabular import value


def numeric_features(frame, features):
    if len(set(features)) != len(features):
        raise HTTPException(
            400, "Choose distinct features; duplicate selections are not supported."
        )
    if any(
        c not in frame.columns or not pd.api.types.is_numeric_dtype(frame[c])
        for c in features
    ):
        raise HTTPException(
            400, "Every selected feature must be an existing numeric column."
        )
    return frame[features].astype(float).replace([np.inf, -np.inf], np.nan)


def detect_period(residual, signal_scale):
    n = len(residual)
    if n < 12 or np.std(residual) <= np.finfo(float).eps * signal_scale * 100:
        return None
    spectrum = np.abs(np.fft.rfft(residual - residual.mean()))
    for i in np.argsort(spectrum[1:])[::-1][:8] + 1:
        period = int(round(n / i))
        if 2 <= period <= min(365, n // 3):
            return period
    return None


def fit_series(y, requested_period):
    x = np.arange(len(y), dtype=float)
    coef = np.polyfit(x, y, 1)
    trend = np.polyval(coef, x)
    period = (
        detect_period(y - trend, max(np.max(abs(y)), np.finfo(float).tiny))
        if requested_period is None
        else requested_period or None
    )
    if period and len(y) < period * 2:
        raise HTTPException(
            400,
            "A custom seasonal period needs at least two complete cycles of training data.",
        )
    phases = (
        np.array(
            [
                np.mean((y - trend)[np.arange(len(y)) % period == p])
                for p in range(period)
            ]
        )
        if period
        else None
    )
    fitted = trend + (phases[np.arange(len(y)) % period] if period else 0)
    return coef, period, phases, fitted


def predict_series(coef, period, phases, start, count):
    x = np.arange(start, start + count)
    return np.polyval(coef, x) + (phases[x % period] if period else 0)


def forecast(frame, req):
    values = numeric_features(frame, [req.target])[req.target]
    dates = frequency = None
    if req.dateColumn:
        if req.dateColumn not in frame or req.dateColumn == req.target:
            raise HTTPException(
                400, "Choose a separate, existing date column, or use row order."
            )
        parsed = pd.to_datetime(
            frame[req.dateColumn], errors="coerce", utc=True, format="mixed"
        )
        if parsed.isna().any() or parsed.duplicated().any():
            raise HTTPException(
                400,
                "The date column must contain valid, unique dates. Clean it or choose row order.",
            )
        order = np.argsort(parsed.to_numpy())
        values = values.iloc[order]
        dates = pd.DatetimeIndex(parsed.iloc[order][values.notna().to_numpy()])
        with pd.option_context("future.infer_freq_returns_offset", True):
            frequency = pd.infer_freq(dates) if len(dates) >= 3 else None
        if frequency is None:
            raise HTTPException(
                400,
                "Date-based forecasting needs regular spacing. Fill date gaps or choose row order.",
            )
    observed = values.dropna().to_numpy(dtype=float)
    n = len(observed)
    if n < 12:
        raise HTTPException(
            400, "Forecasting needs at least 12 complete numeric observations."
        )
    evaluation = {
        "holdoutRows": 0,
        "mae": None,
        "rmse": None,
        "note": "At least 20 observations are needed for a chronological holdout.",
    }
    if n >= 20:
        holdout = max(4, int(math.ceil(n * 0.2)))
        earlier = observed[:-holdout]
        coef0, p0, phases0, _ = fit_series(earlier, req.period)
        predicted = predict_series(coef0, p0, phases0, len(earlier), holdout)
        residual = observed[-holdout:] - predicted
        evaluation = {
            "holdoutRows": holdout,
            "mae": value(np.mean(abs(residual))),
            "rmse": value(np.sqrt(np.mean(residual**2))),
            "note": "Last 20% held out in time order; model fitted only on earlier observations.",
        }
    coef, period, phases, fitted = fit_series(observed, req.period)
    future = predict_series(coef, period, phases, n, req.periods)
    std = float(np.std(observed - fitted))
    denominator = float(np.sum((observed - observed.mean()) ** 2))
    r2 = (
        1 - float(np.sum((observed - fitted) ** 2)) / denominator
        if denominator > 0
        else None
    )
    future_dates = (
        pd.date_range(dates[-1], periods=req.periods + 1, freq=frequency)[1:]
        if dates is not None
        else None
    )
    indices = np.unique(
        np.concatenate(
            [
                np.linspace(0, n - 1, min(n, 1500), dtype=int),
                np.arange(max(0, n - 120), n),
            ]
        )
    )
    history = [
        {
            "index": int(i),
            "date": value(dates[i]) if dates is not None else None,
            "actual": value(observed[i]),
            "fitted": value(fitted[i]),
        }
        for i in indices
    ]
    projections = [
        {
            "index": n + i,
            "date": value(future_dates[i]) if future_dates is not None else None,
            "forecast": value(v),
            "lower": value(v - 1.96 * std),
            "upper": value(v + 1.96 * std),
        }
        for i, v in enumerate(future)
    ]
    tolerance = (
        np.finfo(float).eps * max(np.max(abs(observed)), np.finfo(float).tiny) * 100
    )
    total_trend = coef[0] * max(1, n - 1)
    return {
        "target": req.target,
        "period": period,
        "r2": value(r2),
        "residualStd": value(std),
        "evaluation": evaluation,
        "history": history,
        "historyRows": n,
        "droppedRows": len(frame) - n,
        "future": projections,
        "dateColumn": req.dateColumn,
        "summary": {
            "direction": "upward"
            if total_trend > tolerance
            else "downward"
            if total_trend < -tolerance
            else "flat",
            "avgChangePerStep": value(coef[0]),
            "nextValue": value(future[0]),
            "endValue": value(future[-1]),
        },
    }


def cluster(frame, req):
    complete = numeric_features(frame, req.features).dropna()
    n = len(complete)
    if n <= req.clusters:
        raise HTTPException(
            400, "Choose fewer clusters than the number of complete rows."
        )
    if len(complete.drop_duplicates()) < req.clusters:
        raise HTTPException(
            400,
            "There are fewer distinct feature vectors than clusters. Reduce K or change features.",
        )
    scaler = StandardScaler()
    scaled = scaler.fit_transform(complete)
    model = KMeans(n_clusters=req.clusters, random_state=42, n_init=10)
    labels = model.fit_predict(scaled)
    coordinates = (
        PCA(n_components=2, random_state=42).fit_transform(scaled)
        if len(req.features) > 2
        else scaled
    )
    indices = np.sort(
        np.random.default_rng(42).choice(n, size=min(n, 2000), replace=False)
    )
    points = [
        {
            "x": value(coordinates[i, 0]),
            "y": value(coordinates[i, 1]),
            "cluster": int(labels[i]),
            "row": int(complete.index[i]) + 1,
            "values": {f: value(complete.iloc[i][f]) for f in req.features},
        }
        for i in indices
    ]
    centers = scaler.inverse_transform(model.cluster_centers_)
    sil = None
    if 1 < len(set(labels)) < n:
        try:
            sil = value(
                silhouette_score(
                    scaled, labels, sample_size=min(n, 1000), random_state=42
                )
            )
        except ValueError:
            pass
    return {
        "features": req.features,
        "clusters": req.clusters,
        "points": points,
        "rowsUsed": n,
        "droppedRows": len(frame) - n,
        "projection": "PCA components"
        if len(req.features) > 2
        else "Standardized features",
        "silhouette": sil,
        "silhouetteSample": min(n, 1000),
        "centroids": [
            {f: value(centers[c, j]) for j, f in enumerate(req.features)}
            for c in range(req.clusters)
        ],
        "sizes": {str(c): int((labels == c).sum()) for c in range(req.clusters)},
    }


def classify(frame, req):
    if req.target in req.features:
        raise HTTPException(
            400,
            "The target cannot also be a predictor. That would leak the answer into the model.",
        )
    if req.target not in frame:
        raise HTTPException(400, "Choose an existing target column.")
    features = numeric_features(frame, req.features)
    target = frame[req.target]
    mask = features.notna().all(axis=1) & target.notna()
    features, target = features.loc[mask], target.loc[mask].astype(str)
    if len(features) < 20:
        raise HTTPException(400, "Classification needs at least 20 complete rows.")
    counts = target.value_counts()
    if not 2 <= len(counts) <= 20:
        raise HTTPException(
            400,
            "Choose a target with 2–20 distinct classes, not a continuous measurement.",
        )
    if counts.min() < 2:
        raise HTTPException(
            400,
            "Every target class needs at least two complete rows for a stratified holdout.",
        )
    n_test = int(math.ceil(len(features) * req.testSize))
    if min(n_test, len(features) - n_test) < len(counts):
        raise HTTPException(
            400,
            "Train and test sets must each have room for every class. Adjust the split or add rows.",
        )
    encoder = LabelEncoder()
    labels = encoder.fit_transform(target)
    train_x, test_x, train_y, test_y = train_test_split(
        features, labels, test_size=req.testSize, random_state=42, stratify=labels
    )
    expected_classes = set(range(len(counts)))
    if set(train_y) != expected_classes or set(test_y) != expected_classes:
        raise HTTPException(
            400,
            "The realized holdout does not contain every class. Increase the holdout size or add more observations for rare classes.",
        )
    if np.max(np.abs(features.to_numpy(dtype=float))) > np.finfo(np.float32).max:
        raise HTTPException(
            400,
            "Predictor magnitudes exceed the Random Forest numeric range. Rescale these columns before classification.",
        )
    model = RandomForestClassifier(
        n_estimators=100, max_depth=16, random_state=42, n_jobs=1
    )
    model.fit(train_x, train_y)
    predicted = model.predict(test_x)
    metrics = {
        "accuracy": value(accuracy_score(test_y, predicted)),
        "precision": value(
            precision_score(test_y, predicted, average="weighted", zero_division=0)
        ),
        "recall": value(
            recall_score(test_y, predicted, average="weighted", zero_division=0)
        ),
        "f1": value(f1_score(test_y, predicted, average="weighted", zero_division=0)),
    }
    importance = sorted(
        [
            {"feature": c, "importance": value(v)}
            for c, v in zip(req.features, model.feature_importances_)
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )
    return {
        **metrics,
        "features": req.features,
        "target": req.target,
        "classes": list(encoder.classes_),
        "trainSize": len(train_x),
        "testSize": len(test_x),
        "droppedRows": len(frame) - len(features),
        "confusionMatrix": confusion_matrix(
            test_y, predicted, labels=np.arange(len(counts))
        ).tolist(),
        "featureImportances": importance,
    }


def insights(frame, req):
    numeric = list(frame.select_dtypes(include="number").columns)
    if not numeric:
        raise HTTPException(400, "Insights needs at least one numeric column.")
    data = frame[numeric].astype(float).replace([np.inf, -np.inf], np.nan)
    correlation = data.corr()
    pairs = [
        {"a": a, "b": b, "correlation": value(correlation.loc[a, b])}
        for i, a in enumerate(numeric)
        for b in numeric[i + 1 :]
        if pd.notna(correlation.loc[a, b])
    ]
    pairs.sort(key=lambda item: abs(item["correlation"]), reverse=True)
    z = (data - data.mean()) / data.std().replace(0, np.nan)
    flags = z.abs().gt(req.threshold).any(axis=1)
    rows = []
    for idx in frame.index[flags][:25]:
        scores = z.loc[idx].abs().dropna()
        rows.append(
            {
                "row": int(idx) + 1,
                "values": {c: value(frame.at[idx, c]) for c in frame.columns[:8]},
                "column": scores.idxmax(),
                "value": value(frame.at[idx, scores.idxmax()]),
                "score": value(scores.max()),
            }
        )
    return {
        "numericColumns": numeric,
        "correlationMatrix": [
            [value(v) for v in row] for row in correlation.to_numpy()
        ],
        "topPairs": pairs[:10],
        "anomalies": {"count": int(flags.sum()), "rows": rows},
        "columnStats": [
            {
                "name": c,
                "mean": value(data[c].mean()),
                "std": value(data[c].std()),
                "min": value(data[c].min()),
                "max": value(data[c].max()),
            }
            for c in numeric
        ],
    }
