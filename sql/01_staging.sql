-- Staging: load the raw Olist files and keep only the columns the review uses.
-- {raw} is replaced with the data/raw folder path at run time.

CREATE OR REPLACE TABLE leads AS
SELECT mql_id,
       CAST(first_contact_date AS DATE) AS first_contact_date,
       COALESCE(NULLIF(origin, ''), 'unknown') AS origin
FROM read_csv_auto('{raw}/olist_marketing_qualified_leads_dataset.csv.gz', header = true);

CREATE OR REPLACE TABLE deals AS
SELECT mql_id, seller_id, sdr_id, sr_id,
       CAST(won_date AS TIMESTAMP) AS won_date,
       COALESCE(business_segment, 'unknown') AS business_segment,
       COALESCE(lead_type, 'unknown') AS lead_type,
       COALESCE(business_type, 'unknown') AS business_type,
       COALESCE(lead_behaviour_profile, 'unknown') AS behaviour_profile,
       declared_monthly_revenue
FROM read_csv_auto('{raw}/olist_closed_deals_dataset.csv.gz', header = true);

CREATE OR REPLACE TABLE sellers AS
SELECT seller_id, seller_city, seller_state
FROM read_csv_auto('{raw}/olist_sellers_dataset.csv.gz', header = true);

-- One row per sold item. Canceled and unavailable orders never produced revenue, so they are excluded.
CREATE OR REPLACE TABLE sales AS
SELECT i.seller_id, i.order_id, i.product_id,
       CAST(o.order_purchase_timestamp AS TIMESTAMP) AS ts,
       i.price AS gmv
FROM read_csv_auto('{raw}/olist_order_items_dataset.csv.gz', header = true) i
JOIN read_csv_auto('{raw}/olist_orders_dataset.csv.gz', header = true) o USING (order_id)
WHERE o.order_status NOT IN ('canceled', 'unavailable');

-- Main product category per seller: the category with the most items sold.
-- Ties are broken alphabetically so the result is the same on every machine and DuckDB version.
CREATE OR REPLACE TABLE seller_category AS
WITH items AS (
  SELECT s.seller_id, COALESCE(t.product_category_name_english, p.product_category_name, 'unknown') AS category
  FROM sales s
  LEFT JOIN read_csv_auto('{raw}/olist_products_dataset.csv.gz', header = true) p USING (product_id)
  LEFT JOIN read_csv_auto('{raw}/product_category_name_translation.csv.gz', header = true) t USING (product_category_name)
),
counts AS (SELECT seller_id, category, COUNT(*) AS n FROM items GROUP BY 1, 2),
ranked AS (
  SELECT seller_id, category,
         ROW_NUMBER() OVER (PARTITION BY seller_id ORDER BY n DESC, category ASC) AS rk
  FROM counts
)
SELECT seller_id, category FROM ranked WHERE rk = 1;
