"""Seller book by Brazilian state, as of the risk snapshot."""
import pandas as pd

from . import config



# Official names with accents, which Tableau's map geocoding expects.
STATE_NAMES_PT = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia", "CE": "Ceará",
    "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso",
    "MS": "Mato Grosso do Sul", "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
    "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina",
    "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins",
}


def tableau_table(states: list) -> pd.DataFrame:
    """The state book with plain column names, ready for Tableau Public."""
    return pd.DataFrame([{
        "State Code": s["state"], "State Name": STATE_NAMES_PT.get(s["state"], s["name"]), "Country": "Brazil",
        "Active Sellers": s["active_sellers"], "GMV Last 16 Weeks": round(s["gmv_last16w"], 2),
        "GMV Growth Q2 vs Q1": None if s["gmv_growth"] is None else round(s["gmv_growth"], 4),
        "Flagged At Risk": s["flagged"], "Flagged Share": round(s["flagged_share"], 4),
        "Went Dark Share": round(s["went_dark_share"], 4), "GMV Of Flagged Sellers": round(s["gmv_flagged"], 2),
        "Enough Sellers": "10+ sellers" if s["active_sellers"] >= 10 else "Fewer than 10",
    } for s in states])


def state_book(con, book: pd.DataFrame) -> list:
    """Per state: active sellers, GMV last 16 weeks, GMV growth (Apr-Jun vs Jan-Mar 2018),
    share of the active book flagged at risk, and share that actually went dark."""
    growth = con.sql("""
        SELECT se.seller_state AS state,
               SUM(gmv) FILTER (WHERE ts >= '2018-04-01' AND ts < '2018-07-01') AS q2,
               SUM(gmv) FILTER (WHERE ts >= '2018-01-01' AND ts < '2018-04-01') AS q1
        FROM sales s JOIN sellers se USING (seller_id) GROUP BY 1""").df().set_index("state")
    rows = []
    for state, g in book.groupby("seller_state"):
        q1 = float(growth.q1.get(state) or 0)
        q2 = float(growth.q2.get(state) or 0)
        rows.append({
            "state": state, "name": STATE_NAMES_PT.get(state, state), "active_sellers": len(g),
            "gmv_last16w": float(g.gmv_last16w.sum()),
            "gmv_growth": (q2 / q1 - 1) if q1 > 0 else None,
            "flagged": int(g.flagged.sum()), "flagged_share": float(g.flagged.mean()),
            "went_dark_share": float(g.went_dark.mean()),
            "gmv_flagged": float(g.loc[g.flagged, "gmv_last16w"].sum()),
        })
    return sorted(rows, key=lambda r: -r["gmv_last16w"])
