-- Lead cohort funnel: every lead first contacted in the cohort window, with its outcome.
-- A deal only counts as won if it closed by {win_cutoff}, so every won deal has a full activation window of data.

CREATE OR REPLACE TABLE lead_funnel AS
SELECT l.mql_id,
       l.first_contact_date,
       l.origin,
       d.sr_id,
       d.business_segment,
       d.lead_type,
       d.business_type,
       COALESCE(d.won_date <= TIMESTAMP '{win_cutoff} 23:59:59', false) AS won,
       COALESCE(d.won_date <= TIMESTAMP '{win_cutoff} 23:59:59' AND d.activated, false) AS activated,
       CASE WHEN d.won_date <= TIMESTAMP '{win_cutoff} 23:59:59' THEN d.gmv_window ELSE 0 END AS gmv_window
FROM leads l
LEFT JOIN deal_outcomes d USING (mql_id)
WHERE l.first_contact_date BETWEEN DATE '{cohort_start}' AND DATE '{cohort_end}';
