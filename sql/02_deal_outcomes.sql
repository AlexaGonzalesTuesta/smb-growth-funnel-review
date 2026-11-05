-- One row per closed deal: did the new seller make a first sale within the activation window,
-- and how much GMV did they sell in that window?
-- {act_days} = activation window in days.

CREATE OR REPLACE TABLE deal_outcomes AS
WITH first_sales AS (
  SELECT seller_id, MIN(ts) AS first_sale_ts FROM sales GROUP BY 1
),
window_gmv AS (
  SELECT d.mql_id, SUM(s.gmv) AS gmv_window, COUNT(DISTINCT s.order_id) AS orders_window
  FROM deals d
  JOIN sales s ON s.seller_id = d.seller_id
             AND s.ts >= d.won_date
             AND s.ts < d.won_date + INTERVAL {act_days} DAY
  GROUP BY 1
)
SELECT d.*,
       l.origin,
       l.first_contact_date,
       date_diff('day', l.first_contact_date, CAST(d.won_date AS DATE)) AS days_to_win,
       f.first_sale_ts,
       date_diff('day', d.won_date, f.first_sale_ts) AS days_to_first_sale,
       COALESCE(f.first_sale_ts < d.won_date + INTERVAL {act_days} DAY, false) AS activated,
       COALESCE(w.gmv_window, 0) AS gmv_window,
       COALESCE(w.orders_window, 0) AS orders_window,
       se.seller_state
FROM deals d
JOIN leads l USING (mql_id)
LEFT JOIN first_sales f USING (seller_id)
LEFT JOIN window_gmv w USING (mql_id)
LEFT JOIN sellers se USING (seller_id);
