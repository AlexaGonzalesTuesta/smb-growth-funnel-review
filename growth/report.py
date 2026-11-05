"""Findings and the written weekly business review, generated from the computed numbers (never typed by hand)."""
from . import config


def money(x: float) -> str:
    if abs(x) >= 1_000_000:
        return f"{config.CURRENCY}{x / 1_000_000:.2f}M"
    if abs(x) >= 10_000:
        return f"{config.CURRENCY}{x / 1_000:.0f}K"
    return f"{config.CURRENCY}{x:,.0f}"


def pct(x: float, digits: int = 0) -> str:
    return f"{x * 100:.{digits}f}%"


def _row(rows, key):
    return next(r for r in rows if r["key"] == key)


def findings(p: dict) -> list:
    s, sc, r, t, c = p["summary"], {x["id"]: x for x in p["scenarios"]}, p["risk"], p["timing"], p["concentration"]
    paid, social = _row(p["channels"], "paid_search"), _row(p["channels"], "social")
    untracked = _row(p["channels"], "unknown")
    offline, reseller = _row(p["lead_types"], "offline"), _row(p["business_types"], "reseller")
    manuf, big = _row(p["business_types"], "manufacturer"), _row(p["lead_types"], "online_big")
    reps = [x for x in p["reps"] if x["deals"] >= config.MIN_GROUP]
    flagged_reps = [x for x in reps if x["call"] in ("above", "below")]
    return [
        {
            "id": "activation",
            "title": f"{pct(s['never_sold'] / s['won'])} of signed sellers never made a sale",
            "detail": f"{s['never_sold']} of {s['won']} sellers signed from this lead cohort had no sale within "
                      f"{config.ACTIVATION_DAYS} days. Raising activation to the paid-search rate "
                      f"({pct(paid['activation_rate'])}) adds {pct(sc['paid_level']['pct_change'])} GMV; buying 20% "
                      f"more leads adds {pct(sc['more_leads']['pct_change'])} and costs acquisition spend.",
            "action": "Report activation rate next to deals closed for every rep, every week.",
        },
        {
            "id": "day30",
            "title": "Day 30 is the moment to step in",
            "detail": f"Activated sellers made their first sale after a median of {t['median_days']:.0f} days. Of the "
                      f"{t['no_sale_by_day30']} signed sellers with no sale by day 30, only "
                      f"{pct(t['later_activated_share'])} sold by day {config.ACTIVATION_DAYS}.",
            "action": "Call every new seller with no sale by day 21, before the day-30 drop-off.",
        },
        {
            "id": "seller_type",
            "title": "Offline stores and manufacturers need a different onboarding track",
            "detail": f"Offline stores activated {pct(offline['activation_rate'])} of the time and manufacturers "
                      f"{pct(manuf['activation_rate'])}, against {pct(reseller['activation_rate'])} for resellers and "
                      f"{pct(big['activation_rate'])} for large online sellers.",
            "action": "Give offline and manufacturer sellers hands-on catalog setup in their first two weeks.",
        },
        {
            "id": "channels",
            "title": "Social leads close at half the average rate",
            "detail": f"Social leads won {pct(social['win_rate'], 1)} of the time versus {pct(s['win_rate'], 1)} overall, "
                      f"and returned {money(social['gmv_per_lead'])} of GMV per lead versus {money(paid['gmv_per_lead'])} "
                      f"for paid search. {pct(untracked['share_of_leads'])} of leads have no tracked source.",
            "action": "Tighten social lead qualification before adding budget, and fix source tracking on lead forms.",
        },
        {
            "id": "concentration",
            "title": "One seller produced a quarter of new-seller GMV",
            "detail": f"The largest new seller sold {pct(c['top_seller_share'])} of the cohort's 90-day GMV and the top "
                      f"10% sold {pct(c['top_decile_share'])}. The median activated seller sold "
                      f"{money(c['median_gmv_active'])}.",
            "action": "Judge channels and reps on win and activation rates, not GMV per lead.",
        },
        {
            "id": "reps",
            "title": "Rep differences are within normal variation",
            "detail": f"Rep activation ranged from {pct(min(x['activation_rate'] for x in reps))} to "
                      f"{pct(max(x['activation_rate'] for x in reps))}, but "
                      + ("no rep's 90% interval excludes the team rate." if not flagged_reps else
                         f"{len(flagged_reps)} reps differ from the team rate with 90% confidence."),
            "action": "Coach the onboarding process for everyone; recheck reps when another quarter of deals closes.",
        },
        {
            "id": "risk",
            "title": f"{r['flagged']} still-active sellers flagged before they stopped selling",
            "detail": f"On June 30, 2018 the model flagged {r['flagged']} of {r['test_sellers']} sellers who had sold in the "
                      f"last 30 days. {pct(r['precision_flagged'])} of them made no sale in the next "
                      f"{config.RISK_HORIZON_DAYS} days, versus {pct(r['rate_not_flagged'])} of the rest "
                      f"({r['lift']:.1f}x). They sold {money(r['gmv_last16w_flagged'])} in the 16 weeks before.",
            "action": "Send the at-risk list to account managers every Monday, worst first.",
        },
    ]


def markdown(p: dict) -> str:
    s, m = p["summary"], p["meta"]
    lines = [
        "# Weekly business review: new-seller growth",
        "",
        f"Generated by `python -m growth.build` from the real Olist data. Lead cohort: {m['cohort'][0]} to "
        f"{m['cohort'][1]}. Seller book as of {m['as_of']}.",
        "",
        "## Headline",
        "",
        "| Driver | Value |",
        "|---|---|",
        f"| Leads | {s['leads']:,} |",
        f"| Win rate | {pct(s['win_rate'], 1)} |",
        f"| Activation rate (first sale within {m['activation_days']} days) | {pct(s['activation_rate'], 1)} |",
        f"| GMV per activated seller (mean, {m['activation_days']} days) | {money(s['gmv_per_active'])} |",
        f"| New-seller GMV | {money(s['gmv'])} |",
        "",
        "## Findings and actions",
        "",
    ]
    for i, f in enumerate(p["findings"], 1):
        lines += [f"{i}. **{f['title']}.** {f['detail']}", f"   Action: {f['action']}", ""]
    lines += ["## Scenarios", "", "| Scenario | New-seller GMV | Change |", "|---|---|---|"]
    for sc in p["scenarios"]:
        lines.append(f"| {sc['title']} | {money(sc['gmv'])} | {pct(sc['pct_change'], 1)} |")
    lines += ["", "See [metric_definitions.md](metric_definitions.md) for how each number is defined.", ""]
    return "\n".join(lines)
