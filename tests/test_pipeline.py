import json

import pandas as pd

from growth import build, config, db, funnel


def test_funnel_counts_are_consistent(con):
    s = funnel.summary(funnel.lead_funnel(con))
    assert s["leads"] == 4695
    assert s["activated"] <= s["won"] <= s["leads"]
    assert s["never_sold"] == s["won"] - s["activated"]


def test_leads_outside_cohort_are_excluded(con):
    lf = funnel.lead_funnel(con)
    assert lf.first_contact_date.min() >= pd.Timestamp(config.COHORT_START)
    assert lf.first_contact_date.max() <= pd.Timestamp(config.COHORT_END)


def test_activation_never_counts_sales_before_signing(con):
    bad = con.execute("SELECT COUNT(*) FROM deal_outcomes WHERE activated AND days_to_first_sale < 0").fetchone()[0]
    assert bad == 0


def test_seller_book_has_no_lookahead(con):
    """Features come only from sales before the snapshot: a seller's last sale can't be after it."""
    book = db.seller_book(con, config.RISK_TEST_SNAPSHOT)
    assert (book.days_since_last_sale >= 0).all()
    assert (book.orders_last4w + book.orders_prior12w >= 3).all()


def test_channel_rows_add_up(con):
    lf = funnel.lead_funnel(con)
    rows = funnel.by_channel(lf)
    assert sum(r["leads"] for r in rows) == len(lf)
    assert abs(sum(r["gmv"] for r in rows) - lf.gmv_window.sum()) < 0.01


def test_site_payload_schema():
    p = build.run()
    data = json.loads((config.SITE / "data.json").read_text(encoding="utf-8"))
    for key in ("meta", "summary", "tree", "scenarios", "channels", "reps", "states", "at_risk", "findings", "risk"):
        assert key in data
    assert len(data["at_risk"]) == data["risk"]["flagged"]
    assert all(set(f) == {"id", "title", "detail", "action"} for f in data["findings"])
    assert p["summary"]["won"] == data["summary"]["won"]
    # The page must not show raw seller or rep hashes.
    assert all(r["rep"].startswith("Rep ") for r in data["reps"])
    assert all(len(x["id"]) == 8 for x in data["at_risk"])
