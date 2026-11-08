# Analysis methods, metrics and limitations

All methods are deterministic exploratory baselines, not automatic scientific conclusions. Read `analysisScope` before interpreting a result. Overview describes the stored table; a large-table model may use a subset.

## Overview / data profile

DuckDB infers numeric, date/time and text types. Small-cardinality nonnumeric fields are labeled categorical for the interface. A column with mixed incompatible values may remain text; it is not silently treated as a clean numeric field.

Per column, the app reports nonmissing count, missing count and distinct values. Numeric fields also expose mean, sample standard deviation, minimum, maximum, median and histogram bins. Histogram counts come from the full stored table. Large-table medians use approximate quantiles; high-cardinality distinct counts use approximate counting. These are labeled in the interface/API.

Infinite values become missing. Numeric magnitudes above `1e100` are rejected to keep downstream arithmetic in a stable range. Missing values are never described as observed zeros.

## Trend Forecast

### Inputs

- Numeric target; at least 12 complete observations.
- Either file row order or an existing date column. Date-based analysis requires valid, unique dates and an inferable regular cadence within the modeled window. Daily and business-day cadences can both be valid.
- Horizon: 1–365 steps.
- Seasonality: automatic, none (`period=0`) or a custom period of 2–365 steps. Custom seasonality requires at least two full cycles in the training portion.

Rows with missing numeric targets are excluded and counted. In row-order mode, a step is one retained observation. Do not use row order as a calendar forecast unless each observation represents an equal time interval.

### Calculation

1. Fit least-squares linear trend `trend(t) = intercept + slope × t`.
2. Subtract trend to obtain residuals.
3. In auto mode, inspect the residual FFT spectrum for a dominant repeating period. Near-flat residuals have no detected cycle.
4. For each seasonal phase, calculate the mean detrended residual. Add that repeating phase pattern to the trend.
5. Extend the same trend and phases into the requested future steps.

This is a lightweight trend/seasonal baseline, not ARIMA, Prophet, a transformer or a foundation model. A detected period can be noise. Test whether a proposed cycle makes domain sense.

### Evaluation

With at least 20 observations, the last 20% (at least four observations) form a chronological holdout. A model is fit only to earlier observations, including its period detection, then forecasts the held-out segment.

- **MAE:** mean absolute prediction error, in the target's original units.
- **RMSE:** square root of mean squared prediction error, also in original units; larger misses receive greater weight.
- **In-sample R²:** historical fit of the final model refit on the complete modeled window. It is not holdout accuracy. A constant target has an undefined R².

The final forecast uses a full-window refit after evaluation. The plotted residual range is `forecast ± 1.96 × residual standard deviation`. It is **descriptive, not a calibrated 95% confidence/prediction interval**. It does not widen with horizon or account for all estimation uncertainty.

On more than 25,000 stored rows, the model uses the latest 25,000 observations by date or the last 25,000 file-order rows. It does not claim to train on the entire larger history. The chart downsamples distant history but retains the recent window at full display resolution. Forecast exports contain every requested future step.

### Limitations

No external regressors, changing regimes, holiday model, missing-date repair, backtest over multiple folds or causal interpretation. Simulated stock forecasts are a demonstration, not investment guidance.

## K-Means clustering

### Validation and fitting

Select 2–20 distinct numeric features and K between 2 and 10. Invalid/missing/nonfinite rows are excluded. The number of complete rows must exceed K, and at least K distinct feature vectors must exist.

`StandardScaler` centers/scales features before K-Means, preventing a high-unit measurement from dominating solely because of scale. K-Means uses `random_state=42` and 10 initializations.

The plot uses standardized coordinates for two features, or two PCA components when more than two features are selected. **These axes are transformed units.** The centroid table applies the inverse scaler so measurements there are in original feature units.

### Silhouette and display sampling

Silhouette compares within-cluster closeness with the nearest alternative cluster. It ranges from −1 to 1; a higher value suggests better separation for this distance representation. It is not a probability or proof of a real-world category.

The score uses at most 1,000 sampled analysis points, avoiding an unbounded pairwise-distance calculation. It is unavailable when mathematically undefined or the score sample lacks enough labels. The scatter plot displays at most 2,000 deterministic points; all complete analysis rows contribute to fitting. Large-source analysis itself uses the 25,000-row reservoir sample.

K-Means favors compact distance-based groups and is sensitive to selected features, K and outliers. Cluster numbers have no ranking or permanent semantic meaning. A different dataset or feature set can reorder labels.

## Random Forest classification

### Inputs and leakage protection

Choose a target with 2–20 classes and 1–20 numeric predictors. The target cannot be a predictor. Class labels must be at most 200 characters. There must be at least 20 complete observations, at least two observations per class, and enough train/test rows to contain every class.

Missing targets are excluded **before** conversion to labels. A missing value is not made into a fake `nan` category. The split is stratified, reproducible (seed 42) and configurable from 10% to 40% holdout.

The model has 100 trees, maximum depth 16 and one model thread. It trains only on the training split. Predictors are not scaled because the tree model does not require standardization.

Every class is checked in both realized partitions after splitting; a mathematically possible split is not assumed to contain every rare class. An unsuitable realized holdout is rejected with guidance to add examples or adjust the split. Predictor magnitudes beyond Random Forest's float32 input range receive an actionable rescaling error rather than a server crash.

### Outputs

- **Accuracy:** share of held-out rows classified correctly.
- **Weighted precision:** class precision averaged by held-out class support.
- **Weighted recall:** class recall averaged by held-out class support.
- **Weighted F1:** weighted harmonic balance of precision and recall.
- **Confusion matrix:** actual labels in rows, predicted labels in columns; diagonal cells are correct predictions.
- **Feature importance:** impurity-based importance in this fitted forest. It can favor high-cardinality features and is not evidence of causation.

Weighted averages can hide poor performance on rare classes. Inspect the confusion matrix and the class balance. A single split is not cross-validation or an external validation study.

Direct target leakage is blocked, but the app cannot automatically recognize an indirect copy of the target, a post-outcome variable or a personal identifier. Feature selection remains the analyst's responsibility. Reservoir sampling of very large sources can miss rare classes; results explicitly describe that subset.

## Insights

### Pearson correlation

The app computes pairwise linear correlations across the numeric analysis fields. Missing observations are excluded pairwise. Constant/all-missing relationships remain undefined and appear as `—`, rather than a fabricated zero correlation.

The top ten valid pairs are ranked by absolute coefficient; the signed coefficient is retained. Correlation is symmetric, not causal. A near-zero Pearson coefficient can still hide a nonlinear relationship.

### Z-score flags

For each observed numeric value, `z = (value − mean) / sample standard deviation`. A row is flagged if any absolute z-score exceeds the selected threshold (2–6, default 3). Missing values remain missing and zero-variance columns do not create flags.

The response contains the total flagged count within the analysis subset and at most the first 25 flagged source-row numbers. Each shows its strongest deviation and actual value. This is a shortlist for investigation, not an instruction to delete observations.

Skewed/heavy-tailed distributions, small samples and many comparisons affect z-score usefulness. The method is not an isolation forest, robust anomaly detector or guaranteed fraud/error detector.

## Why results are not called “AI certainty”

The project prioritizes inspectable inputs, reproducible calculations, meaningful validation and clear limitations. A polished chart does not make a model correct. Use these tools to ask better questions, then validate the answer with domain knowledge, representative data and an evaluation design suited to the actual problem.

API/export numbers retain available floating-point precision rather than being rounded to six decimal places. Small nonzero measurements use scientific notation in the UI. Numerical models still use finite-precision arithmetic; unusually extreme units may need rescaling.
