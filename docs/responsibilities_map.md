# How this project maps to the Data Business Analyst (GBS) responsibilities

| Responsibility in the posting | Where it is in this project |
|---|---|
| Build an operating analysis framework and data infrastructure for business health | SQL models in `sql/`, run by DuckDB from the raw files; one config file for every window (`growth/config.py`) |
| Decompose goals and set process indicator systems | Driver tree (leads x win rate x activation x GMV per seller) with owners per indicator: [metric_definitions.md](metric_definitions.md); live driver sliders with real benchmarks |
| Targeted analysis of core operating indicators and abnormal data | At-risk seller model (sellers about to stop selling), state growth outliers, the GMV concentration check |
| Output clear business improvement suggestions | Seven findings, each with one action: [weekly_business_review.md](weekly_business_review.md) |
| Find business opportunities and set reasonable goals | Scenarios priced from the data, each benchmarked against a rate a real channel or seller group already reaches |
| Calculate, track and review business goals and sales team assessment goals | Rep scorecard with 90% intervals, so reps are not ranked on noise |
| Proficiency in Tableau / Power BI | [Tableau Public dashboard](https://public.tableau.com/app/profile/alexa.gonzales.tuesta/viz/OlistSellerBook/Sellerbook) with calculated fields, an LOD expression, and filter and highlight actions: [tableau_guide.md](tableau_guide.md) |
| SQL proficiency | All metrics are SQL (`sql/01` to `sql/04`); Python only orchestrates and models |
