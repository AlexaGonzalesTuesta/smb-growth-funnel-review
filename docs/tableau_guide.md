# How the Tableau dashboard is built

Live: [Olist seller book on Tableau Public](https://public.tableau.com/app/profile/alexa.gonzales.tuesta/viz/OlistSellerBook/Sellerbook).
Workbook: `data/tableau/olist_seller_book.twbx`. It is also embedded on the live page, right below the driver tree.

**The question it answers:** on June 30, 2018, which active sellers are about to stop selling, where are they, and how much in sales is at stake?

**Data source:** `data/tableau/seller_book.csv`, one row per active seller (915 rows), written by `python -m growth.build`, so the dashboard and the live page always use the same numbers.

## Calculated fields

| Name | Formula | Used for |
|---|---|---|
| Active Sellers | `COUNTD([Seller ID])` | KPI, tooltips |
| Flagged Sellers | `SUM(IF [Flagged] = "Yes" THEN 1 ELSE 0 END)` | KPI, bar labels |
| Share Flagged | `[Flagged Sellers] / [Active Sellers]` | Bar length |
| GMV at Risk | `SUM(IF [Flagged] = "Yes" THEN [GMV Last 16 Weeks] ELSE 0 END)` | KPI, map and bar color |
| Flagged Hit Rate | `SUM(IF [Flagged] = "Yes" AND [Went Dark] = "Yes" THEN 1 ELSE 0 END) / [Flagged Sellers]` | KPI: how often a flag was right |
| Rest Went Dark | `SUM(IF [Flagged] = "No" AND [Went Dark] = "Yes" THEN 1 ELSE 0 END) / SUM(IF [Flagged] = "No" THEN 1 ELSE 0 END)` | KPI: the baseline to compare against |
| Sellers In State | `{ FIXED [State Name] : COUNTD([Seller ID]) }` | LOD expression that hides states with fewer than 10 sellers from the bar chart |

## Sheets

| Sheet | Build |
|---|---|
| KPIs | Measure Values on Text, Measure Names on Columns; five measures with aliased headers |
| Map | Filled map of Brazil by State Name (geographic role State/Province, Country set to Brazil), colored by GMV at Risk (`#FBE9E7` to `#B42318`), State Code as label, pan and zoom locked |
| States | Share Flagged by state, filtered to Sellers In State >= 10, sorted descending, labeled with Flagged Sellers |
| At-risk sellers | Flagged = Yes; seller, category, reason and outcome on Rows; days since last sale, GMV and risk score as values; colored by Went Dark (`#B42318` yes, `#0E7C61` no); sorted by Risk Score |

## Dashboard actions

* **Filter:** clicking a state on the map or a bar filters the KPIs and the at-risk seller list to that state. Clearing the selection shows all values.
* **Highlight:** clicking a state on the map highlights its bar, and the reverse, without hiding the other states.

## Checks

With no state selected, the KPIs read 915 active sellers, 183 flagged, 25% of flagged sellers stopped selling, 8% of the others, and R$157K in sales at risk. These match the live page and `reports/eval_report.md`.

## Updating it

1. Run `python -m growth.build` to refresh `data/tableau/seller_book.csv`.
2. In Tableau, open `data/tableau/olist_seller_book.twbx`, then menu **Data** > **Refresh All Extracts** (or right-click the data source > **Refresh**).
3. Republish: **File** > **Save to Tableau Public** (Tableau Desktop: **Server** > **Tableau Public** > **Save to Tableau Public**).
