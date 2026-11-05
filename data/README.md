# Data

All data is real and public. Nothing is simulated.

| File | Source (Kaggle) | Rows | Used for |
|---|---|---|---|
| `raw/olist_marketing_qualified_leads_dataset.csv.gz` | [Marketing Funnel by Olist](https://www.kaggle.com/datasets/olistbr/marketing-funnel-olist) | 8,000 | Leads and their source |
| `raw/olist_closed_deals_dataset.csv.gz` | Marketing Funnel by Olist | 842 | Signed sellers, sales rep, seller attributes |
| `raw/olist_sellers_dataset.csv.gz` | [Brazilian E-Commerce by Olist](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) | 3,095 | Seller state and city |
| `raw/olist_orders_dataset.csv.gz` | Brazilian E-Commerce by Olist | 99,441 | Order date and status |
| `raw/olist_order_items_dataset.csv.gz` | Brazilian E-Commerce by Olist | 112,650 | Seller, item price (GMV) |
| `raw/olist_products_dataset.csv.gz` | Brazilian E-Commerce by Olist | 32,951 | Product category |
| `raw/product_category_name_translation.csv.gz` | Brazilian E-Commerce by Olist | 71 | Category names in English |

The files are the Kaggle originals, gzip-compressed so each fits under GitHub's upload limit. The evaluation
suite (`python -m evals.run_evals`) checks the row counts against the Kaggle originals on every run.

Seller IDs, rep IDs and customer IDs are anonymized hashes in the source. The live page shortens seller IDs
and renumbers reps by deal volume.

`tableau/` holds tidy extracts written by `python -m growth.build` for the Tableau Public view
(see [docs/tableau_guide.md](../docs/tableau_guide.md)).

License: CC BY-NC-SA 4.0 (Olist). Non-commercial use with attribution.
