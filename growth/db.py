"""DuckDB connection that runs the SQL models in sql/ against the raw Olist files."""
import duckdb

from . import config


def render(name: str, **params) -> str:
    text = (config.SQL / name).read_text(encoding="utf-8")
    params.setdefault("raw", config.RAW.as_posix())
    for key, value in params.items():
        text = text.replace("{" + key + "}", str(value))
    return text


def connect() -> duckdb.DuckDBPyConnection:
    """Build the staging tables, deal outcomes and lead funnel in an in-memory database."""
    con = duckdb.connect()
    con.execute(render("01_staging.sql"))
    con.execute(render("02_deal_outcomes.sql", act_days=config.ACTIVATION_DAYS))
    con.execute(render("03_lead_funnel.sql", win_cutoff=config.WIN_CUTOFF,
                       cohort_start=config.COHORT_START, cohort_end=config.COHORT_END))
    return con


def seller_book(con, snapshot: str, horizon: int = config.RISK_HORIZON_DAYS):
    return con.sql(render("04_seller_book.sql", snap=snapshot, horizon=horizon)).df()
