"""Small statistics helpers."""
import math

from . import config


def wilson(k: int, n: int, z: float = config.Z):
    """Wilson score interval for a proportion. Returns (low, high); (0, 1) when n is 0."""
    if n == 0:
        return 0.0, 1.0
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


def call_out(k: int, n: int, baseline: float) -> str:
    """'above' or 'below' only when the 90% interval excludes the baseline and the group is big enough."""
    if n < config.MIN_GROUP:
        return "small"
    low, high = wilson(k, n)
    if low > baseline:
        return "above"
    if high < baseline:
        return "below"
    return "in line"
