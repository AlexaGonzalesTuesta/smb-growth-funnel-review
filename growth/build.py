"""Run the whole review: SQL models, funnel, driver tree, risk model, regions.
Writes site/data.json (read by the live page), data/tableau/*.csv and docs/weekly_business_review.md.

    python -m growth.build
"""
import json
import math

from . import activation, config, db, drivers, funnel, regions, report, risk


def _clean(obj):
    """Make the payload JSON-safe: tuples to lists, NaN to None, numpy numbers to Python numbers."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if hasattr(obj, "item"):
        obj = obj.item()
    if isinstance(obj, float):
        return None if math.isnan(obj) else round(obj, 4)
    return obj


def seller_book_table(book):
    """One row per active seller on the snapshot date: the data source for the Tableau Public dashboard."""
    import pandas as pd
    return pd.DataFrame({
        "Seller ID": "S-" + book.seller_id.str[:6].str.upper(),
        "State Code": book.seller_state,
        "State Name": book.seller_state.map(regions.STATE_NAMES_PT),
        "Country": "Brazil",
        "City": book.seller_city.str.title(),
        "Main Category": book.category.str.replace("_", " ").str.capitalize(),
        "GMV Last 16 Weeks": book.gmv_last16w.round(2),
        "Orders Last 4 Weeks": book.orders_last4w,
        "Orders Prior 12 Weeks": book.orders_prior12w,
        "Days Since Last Sale": book.days_since_last_sale,
        "Weeks Active Of Last 16": book.weeks_active16,
        "Risk Score": book.risk.round(4),
        "Flagged": book.flagged.map({True: "Yes", False: "No"}),
        "Main Reason": book.reason,
        "Went Dark": book.went_dark.map({True: "Yes", False: "No"}),
        "GMV Next 60 Days": book.gmv_next.round(2),
    })


def run() -> dict:
    con = db.connect()
    lf = funnel.lead_funnel(con)
    deals = funnel.won_deals(con)
    s = funnel.summary(lf)
    tree = drivers.from_summary(s)
    channels = funnel.by_channel(lf)
    reps = funnel.rep_scorecard(deals)
    r = risk.evaluate(con)
    book = r["book"]
    states = regions.state_book(con, book)
    act_model = activation.evaluate(deals)

    at_risk = []
    for row in book[book.flagged].itertuples():
        at_risk.append({
            "id": "S-" + row.seller_id[:6].upper(), "state": row.seller_state, "city": row.seller_city,
            "category": row.category.replace("_", " "), "gmv_last16w": row.gmv_last16w,
            "days_since": int(row.days_since_last_sale), "weeks_active16": int(row.weeks_active16),
            "risk": row.risk, "reason": row.reason, "went_dark": bool(row.went_dark), "gmv_next": row.gmv_next,
        })

    payload = {
        "meta": {
            "source": "Olist Brazilian E-Commerce + Marketing Funnel datasets (Kaggle, CC BY-NC-SA 4.0)",
            "cohort": [config.COHORT_START, config.COHORT_END], "win_cutoff": config.WIN_CUTOFF,
            "activation_days": config.ACTIVATION_DAYS, "as_of": config.RISK_TEST_SNAPSHOT,
            "horizon_days": config.RISK_HORIZON_DAYS, "currency": config.CURRENCY,
            "data_end": config.DATA_END,
        },
        "summary": s,
        "tree": tree.to_dict(),
        "scenarios": drivers.scenarios(tree, channels, reps, deals),
        "channels": channels,
        "lead_types": funnel.by_dimension(deals, "lead_type"),
        "business_types": funnel.by_dimension(deals, "business_type"),
        "segments": funnel.by_dimension(deals, "business_segment"),
        "reps": reps,
        "timing": funnel.activation_timing(deals),
        "concentration": funnel.concentration(lf),
        "deals_total": len(deals), "deals_activation_rate": float(deals.activated.mean()),
        "risk": r["metrics"], "at_risk": at_risk,
        "states": states,
        "activation_model": act_model,
    }
    payload["findings"] = report.findings(payload)
    payload = _clean(payload)

    (config.SITE / "data.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    config.TABLEAU.mkdir(parents=True, exist_ok=True)
    import pandas as pd
    regions.tableau_table(states).to_csv(config.TABLEAU / "state_book.csv", index=False, encoding="utf-8-sig")
    seller_book_table(book).to_csv(config.TABLEAU / "seller_book.csv", index=False, encoding="utf-8-sig")
    pd.DataFrame([{k: v for k, v in c.items() if k != "act_ci"} for c in channels]).to_csv(
        config.TABLEAU / "funnel_by_channel.csv", index=False)
    pd.DataFrame(at_risk).to_csv(config.TABLEAU / "at_risk_sellers.csv", index=False)
    (config.DOCS / "weekly_business_review.md").write_text(report.markdown(payload), encoding="utf-8")
    return payload


if __name__ == "__main__":
    p = run()
    print(f"Built site/data.json: {p['summary']['leads']} leads, {p['summary']['won']} won, "
          f"{p['summary']['activated']} activated, {len(p['at_risk'])} sellers flagged at risk.")
