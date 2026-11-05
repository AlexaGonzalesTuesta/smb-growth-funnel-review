"""Check that the committed site/data.json matches a fresh rebuild.

Numbers may differ in the last decimal across Python, NumPy and scikit-learn versions, so floats are
compared with a small tolerance; counts, labels and structure must match exactly.

    python scripts/check_site_data.py committed.json site/data.json
"""
import json
import math
import sys

TOLERANCE = 0.002


def compare(a, b, path, problems):
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a) != set(b):
            problems.append(f"{path}: keys differ")
        for k in set(a) & set(b):
            compare(a[k], b[k], f"{path}.{k}", problems)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            problems.append(f"{path}: {len(a)} items vs {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            compare(x, y, f"{path}[{i}]", problems)
    elif isinstance(a, float) or isinstance(b, float):
        if a is None or b is None or not math.isclose(a, b, rel_tol=TOLERANCE, abs_tol=TOLERANCE):
            problems.append(f"{path}: {a} vs {b}")
    elif a != b:
        problems.append(f"{path}: {a!r} vs {b!r}")


def main(committed, rebuilt):
    with open(committed, encoding="utf-8") as f:
        a = json.load(f)
    with open(rebuilt, encoding="utf-8") as f:
        b = json.load(f)
    problems = []
    compare(a, b, "data", problems)
    if problems:
        print("site/data.json is stale. Run python -m growth.build and commit it. Differences:")
        for p in problems[:20]:
            print("  " + p)
        return 1
    print("site/data.json matches a fresh rebuild.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
