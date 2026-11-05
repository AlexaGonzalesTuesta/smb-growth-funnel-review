-- Seller book as of a snapshot date {snap}: activity features computed only from sales BEFORE the snapshot,
-- and the outcome (no sale in the next {horizon} days) computed only from sales AFTER it.
-- The active book: sold in the last 30 days and has 3+ orders in the 16 weeks before the snapshot.

WITH hist AS (SELECT * FROM sales WHERE ts < TIMESTAMP '{snap}'),
feat AS (
  SELECT seller_id,
    COUNT(DISTINCT order_id) FILTER (WHERE ts >= TIMESTAMP '{snap}' - INTERVAL 28 DAY) AS orders_last4w,
    COUNT(DISTINCT order_id) FILTER (WHERE ts >= TIMESTAMP '{snap}' - INTERVAL 112 DAY
                                       AND ts <  TIMESTAMP '{snap}' - INTERVAL 28 DAY) AS orders_prior12w,
    COALESCE(SUM(gmv) FILTER (WHERE ts >= TIMESTAMP '{snap}' - INTERVAL 112 DAY), 0) AS gmv_last16w,
    date_diff('day', MAX(ts), TIMESTAMP '{snap}') AS days_since_last_sale,
    date_diff('day', MIN(ts), TIMESTAMP '{snap}') AS tenure_days,
    COUNT(DISTINCT date_trunc('week', ts)) FILTER (WHERE ts >= TIMESTAMP '{snap}' - INTERVAL 112 DAY) AS weeks_active16,
    COUNT(DISTINCT order_id) AS lifetime_orders
  FROM hist GROUP BY 1
),
future AS (
  SELECT seller_id, COUNT(DISTINCT order_id) AS orders_next, SUM(gmv) AS gmv_next
  FROM sales
  WHERE ts >= TIMESTAMP '{snap}' AND ts < TIMESTAMP '{snap}' + INTERVAL {horizon} DAY
  GROUP BY 1
)
SELECT f.*,
       s.seller_state, s.seller_city,
       COALESCE(c.category, 'unknown') AS category,
       COALESCE(fu.orders_next, 0) = 0 AS went_dark,
       COALESCE(fu.gmv_next, 0) AS gmv_next
FROM feat f
LEFT JOIN future fu USING (seller_id)
LEFT JOIN sellers s USING (seller_id)
LEFT JOIN seller_category c USING (seller_id)
WHERE f.orders_last4w + f.orders_prior12w >= 3
  AND f.days_since_last_sale <= 30;
