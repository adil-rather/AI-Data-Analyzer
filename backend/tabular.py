"""Convert analytical scalar values to finite, JSON-safe public values."""

from datetime import date, datetime
from decimal import Decimal
import math
import numpy as np
import pandas as pd


def value(item):
    if item is None or item is pd.NA or item is pd.NaT:
        return None
    if isinstance(item, (bool, np.bool_)):
        return bool(item)
    if isinstance(item, (int, np.integer)):
        return int(item)
    if isinstance(item, (float, np.floating, Decimal)):
        number = float(item)
        return number if math.isfinite(number) else None
    if isinstance(item, (pd.Timestamp, datetime, date)):
        return item.isoformat()
    return str(item)
