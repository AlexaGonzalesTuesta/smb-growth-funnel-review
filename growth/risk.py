"""Seller book health: which active sellers are about to stop selling?

Trained on the book as of Mar 31, 2018 (outcome: no sale in the next 60 days) and tested,
untouched, on the book as of Jun 30, 2018 (outcome: no sale Jun 30 to Aug 28).
The active book is every seller who sold in the last 30 days and has 3+ orders in the last 16 weeks."""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from . import config, db

FEATURES = ["order_trend", "days_since_last_sale", "weeks_active16", "log_tenure", "log_lifetime_orders"]


def add_features(book: pd.DataFrame) -> pd.DataFrame:
    b = book.copy()
    # Orders in the last 4 weeks vs the average 4 weeks before that (smoothed so a zero stays finite).
    b["order_trend"] = (b.orders_last4w + 0.5) / (b.orders_prior12w / 3 + 0.5)
    b["log_tenure"] = np.log1p(b.tenure_days)
    b["log_lifetime_orders"] = np.log1p(b.lifetime_orders)
    return b


def fit(train: pd.DataFrame):
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000))
    model.fit(train[FEATURES], train.went_dark)
    return model


def reasons(model, book: pd.DataFrame) -> list:
    """Plain-language reason for each score: the feature pushing risk up the most."""
    scaler, lr = model.named_steps["standardscaler"], model.named_steps["logisticregression"]
    contrib = scaler.transform(book[FEATURES]) * lr.coef_[0]
    out = []
    for row, c in zip(book.itertuples(), contrib):
        top = FEATURES[int(np.argmax(c))]
        if top == "days_since_last_sale":
            out.append(f"No sale in {int(row.days_since_last_sale)} days")
        elif top == "order_trend":
            drop = 1 - row.order_trend
            out.append(f"Orders down {drop:.0%} vs the 12 weeks before" if drop > 0.05 else "Orders flat while peers grow")
        elif top == "weeks_active16":
            out.append(f"Sold in only {int(row.weeks_active16)} of the last 16 weeks")
        elif top == "log_tenure":
            out.append(f"New seller, {int(row.tenure_days)} days on the marketplace")
        else:
            out.append(f"Only {int(row.lifetime_orders)} orders all time")
    return out


def evaluate(con) -> dict:
    train = add_features(db.seller_book(con, config.RISK_TRAIN_SNAPSHOT))
    test = add_features(db.seller_book(con, config.RISK_TEST_SNAPSHOT))
    model = fit(train)
    test["risk"] = model.predict_proba(test[FEATURES])[:, 1]
    test["reason"] = reasons(model, test)
    k = int(round(len(test) * config.RISK_FLAG_SHARE))
    test = test.sort_values("risk", ascending=False).reset_index(drop=True)
    test["flagged"] = test.index < k
    flagged, rest = test[test.flagged], test[~test.flagged]
    # Simple rule a team could run in a spreadsheet, as the baseline the model must beat.
    rule = (test.days_since_last_sale > 21) | (test.order_trend < 0.5)  # spreadsheet rule
    rule_top = test[rule]
    metrics = {
        "train_sellers": len(train), "test_sellers": len(test),
        "base_rate": float(test.went_dark.mean()),
        "auc": float(roc_auc_score(test.went_dark, test.risk)),
        "flagged": int(k),
        "precision_flagged": float(flagged.went_dark.mean()),
        "rate_not_flagged": float(rest.went_dark.mean()),
        "recall": float(flagged.went_dark.sum() / test.went_dark.sum()),
        "lift": float(flagged.went_dark.mean() / test.went_dark.mean()),
        "gmv_last16w_flagged": float(flagged.gmv_last16w.sum()),
        "gmv_last16w_book": float(test.gmv_last16w.sum()),
        "rule_flagged": int(rule.sum()),
        "rule_precision": float(rule_top.went_dark.mean()),
        "rule_recall": float(rule_top.went_dark.sum() / test.went_dark.sum()),
    }
    return {"metrics": metrics, "book": test, "model": model}
