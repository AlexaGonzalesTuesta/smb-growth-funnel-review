"""Lead-to-ramp funnel for the lead cohort, overall and broken down by channel, seller type and rep."""
import pandas as pd

from . import config
from .stats import call_out, wilson

LABELS = {
    "organic_search": "Organic search", "paid_search": "Paid search", "social": "Social",
    "unknown": "Source not tracked", "direct_traffic": "Direct traffic", "email": "Email",
    "referral": "Referral", "other": "Other", "display": "Display ads", "other_publicities": "Other ads",
    "online_medium": "Online, medium", "online_big": "Online, large", "industry": "Industry",
    "offline": "Offline store", "online_small": "Online, small", "online_beginner": "Online, new to e-commerce",
    "online_top": "Online, top seller", "reseller": "Reseller", "manufacturer": "Manufacturer",
}


def label(value: str) -> str:
    return LABELS.get(value, str(value).replace("_", " ").capitalize())


def lead_funnel(con) -> pd.DataFrame:
    return con.sql("SELECT * FROM lead_funnel").df()


def won_deals(con) -> pd.DataFrame:
    """Deals won by the cutoff, any lead date. Used for seller-type and rep views (no lead-date filter needed)."""
    return con.sql(f"""SELECT * FROM deal_outcomes
                       WHERE won_date <= TIMESTAMP '{config.WIN_CUTOFF} 23:59:59'""").df()


def summary(lf: pd.DataFrame) -> dict:
    leads = len(lf)
    won = int(lf.won.sum())
    active = int(lf.activated.sum())
    gmv = float(lf.gmv_window.sum())
    return {
        "leads": leads, "won": won, "activated": active, "gmv": round(gmv, 2),
        "win_rate": won / leads, "activation_rate": active / won if won else 0.0,
        "gmv_per_active": gmv / active if active else 0.0,
        "never_sold": won - active,
    }


def by_channel(lf: pd.DataFrame) -> list:
    """Funnel by lead source. GMV per lead is the end-to-end yield of a channel."""
    total = summary(lf)
    rows = []
    for origin, g in lf.groupby("origin"):
        s = summary(g)
        rows.append({
            "key": origin, "label": label(origin), "leads": s["leads"], "won": s["won"],
            "activated": s["activated"], "win_rate": s["win_rate"],
            "activation_rate": s["activation_rate"] if s["won"] else None,
            "act_ci": wilson(s["activated"], s["won"]),
            "win_call": call_out(s["won"], s["leads"], total["win_rate"]),
            "act_call": call_out(s["activated"], s["won"], total["activation_rate"]),
            "gmv": s["gmv"], "gmv_per_lead": s["gmv"] / s["leads"],
            "share_of_leads": s["leads"] / total["leads"], "share_of_gmv": s["gmv"] / total["gmv"] if total["gmv"] else 0,
        })
    return sorted(rows, key=lambda r: -r["leads"])


def by_dimension(deals: pd.DataFrame, column: str, min_n: int = 10) -> list:
    """Activation and 90-day GMV per won deal for one seller attribute (lead type, business type, segment)."""
    base = deals.activated.mean()
    rows = []
    for value, g in deals.groupby(column):
        n, k = len(g), int(g.activated.sum())
        if n < min_n:
            continue
        rows.append({
            "key": value, "label": label(value), "deals": n, "activated": k,
            "activation_rate": k / n, "ci": wilson(k, n), "call": call_out(k, n, base),
            "gmv_per_deal": float(g.gmv_window.mean()),
            "median_gmv_active": float(g.loc[g.activated, "gmv_window"].median()) if k else 0.0,
        })
    return sorted(rows, key=lambda r: -r["deals"])


def rep_scorecard(deals: pd.DataFrame) -> list:
    """Activation by sales rep (SR). IDs are anonymized hashes in the source; we relabel them by deal volume."""
    base = deals.activated.mean()
    order = deals.sr_id.value_counts()
    names = {sr: f"Rep {i + 1:02d}" for i, sr in enumerate(order.index)}
    rows = []
    for sr, g in deals.groupby("sr_id"):
        n, k = len(g), int(g.activated.sum())
        rows.append({
            "rep": names[sr], "deals": n, "activated": k, "activation_rate": k / n,
            "ci": wilson(k, n), "call": call_out(k, n, base),
            "never_sold": n - k, "median_days_to_first_sale":
                float(g.days_to_first_sale[g.activated].median()) if k else None,
        })
    return sorted(rows, key=lambda r: -r["deals"])


def activation_timing(deals: pd.DataFrame) -> dict:
    """How fast activated sellers make their first sale; tells onboarding when to step in."""
    d = deals.loc[deals.activated, "days_to_first_sale"]
    buckets = [(0, 14, "0-14 days"), (15, 30, "15-30"), (31, 60, "31-60"), (61, 90, "61-90")]
    late = deals[deals.days_to_first_sale.isna() | (deals.days_to_first_sale > 30)]
    return {
        "median_days": float(d.median()),
        "no_sale_by_day30": int(len(late)),
        "later_activated_share": float(late.activated.mean()),
        "buckets": [{"label": lab, "count": int(((d >= lo) & (d <= hi)).sum())} for lo, hi, lab in buckets],
    }


def concentration(lf: pd.DataFrame) -> dict:
    """How concentrated new-seller GMV is. A few large sellers can make any channel look good or bad."""
    g = lf.loc[lf.activated, "gmv_window"].sort_values(ascending=False)
    top_n = max(1, int(round(len(g) * 0.10)))
    return {
        "top_seller_share": float(g.iloc[0] / g.sum()),
        "top_seller_origin": label(lf.loc[lf.gmv_window.idxmax(), "origin"]),
        "top_decile_share": float(g.head(top_n).sum() / g.sum()),
        "median_gmv_active": float(g.median()),
    }
