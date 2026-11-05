"""Every date window and threshold used in the review lives here, so a reader can audit them in one place."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
SQL = ROOT / "sql"
SITE = ROOT / "site"
DOCS = ROOT / "docs"
REPORTS = ROOT / "reports"
TABLEAU = ROOT / "data" / "tableau"

# Lead cohort: leads first contacted Jan 1 - Apr 30, 2018.
# The closed-deals file only covers deals won from Dec 2017, so 2017 leads would look like they never closed.
COHORT_START = "2018-01-01"
COHORT_END = "2018-04-30"

# A won deal counts only if it closed by May 31, 2018. Orders run to Aug 29, 2018,
# so every counted deal has a full 90-day window to make its first sale.
WIN_CUTOFF = "2018-05-31"
ACTIVATION_DAYS = 90
DATA_END = "2018-08-29"

# Seller book health: features as of a snapshot, outcome = no sale in the next 60 days.
RISK_TRAIN_SNAPSHOT = "2018-03-31"
RISK_TEST_SNAPSHOT = "2018-06-30"   # also the "as of" date shown in the review
RISK_HORIZON_DAYS = 60
RISK_FLAG_SHARE = 0.20              # the review flags the riskiest 20% of the active book

# Activation-at-close model: train on deals won Jan-Mar 2018, test on Apr-May 2018.
ACT_TRAIN_END = "2018-04-01"

# 90% intervals: wide enough to be honest about small samples, narrow enough to be useful in a weekly review.
Z = 1.645
MIN_GROUP = 15   # groups smaller than this are shown but never called out as a finding

CURRENCY = "R$"
