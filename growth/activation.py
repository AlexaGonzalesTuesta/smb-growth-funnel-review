"""Can we tell at signing which new sellers will never make a first sale?
Trained on deals won Jan-Mar 2018 and tested on deals won Apr-May 2018."""
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder

from . import config

CATS = ["origin", "lead_type", "business_type", "business_segment", "behaviour_profile"]


def evaluate(deals) -> dict:
    d = deals.copy()
    d["log_days_to_win"] = np.log1p(d.days_to_win.clip(lower=0))
    cols = CATS + ["log_days_to_win"]
    train = d[d.won_date < config.ACT_TRAIN_END]
    test = d[d.won_date >= config.ACT_TRAIN_END].copy()
    enc = ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore", min_frequency=10), CATS)],
                            remainder="passthrough")
    model = make_pipeline(enc, LogisticRegression(C=0.3, max_iter=2000))
    model.fit(train[cols], train.activated)
    test["p"] = model.predict_proba(test[cols])[:, 1]
    third = int(len(test) / 3)
    ranked = test.sort_values("p", kind="mergesort")
    return {
        "train_deals": len(train), "test_deals": len(test),
        "auc": float(roc_auc_score(test.activated, test.p)),
        "activation_lowest_third": float(ranked.head(third).activated.mean()),
        "activation_highest_third": float(ranked.tail(third).activated.mean()),
        "base_rate": float(test.activated.mean()),
    }
