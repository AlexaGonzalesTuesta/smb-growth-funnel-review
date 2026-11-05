# Metric definitions: the indicator system

The review breaks one goal (90-day GMV from newly signed sellers) into process indicators the sales team
can own. Every definition below is implemented in `sql/` and `growth/`; the window dates live in
`growth/config.py`.

## The driver tree

```
New-seller GMV  =  Leads  x  Win rate  x  Activation rate  x  GMV per activated seller
```

| Indicator | Definition | Owner | Source |
|---|---|---|---|
| Leads | Marketing-qualified leads first contacted in the cohort window (Jan 1 to Apr 30, 2018) | Marketing | `sql/03_lead_funnel.sql` |
| Win rate | Leads that became a signed seller by May 31, 2018 / leads | Sales development and sales reps | `sql/03_lead_funnel.sql` |
| Activation rate | Signed sellers with a first sale within 90 days of signing / signed sellers | Sales reps and onboarding | `sql/02_deal_outcomes.sql` |
| GMV per activated seller | Item price (excluding freight) sold by activated sellers in their first 90 days / activated sellers | Account management | `sql/02_deal_outcomes.sql` |

Why these windows: the closed-deals file starts in December 2017, so 2017 leads would look like they never
closed. Orders end on August 29, 2018, so only deals signed by May 31 have a full 90 days to make a first sale.
The evaluation suite fails if any counted deal lacks a full window.

## Seller book health

| Indicator | Definition |
|---|---|
| Active seller | Sold in the 30 days before the snapshot and has 3+ orders in the 16 weeks before it |
| Order trend | Orders in the last 4 weeks / average orders per 4 weeks in the 12 weeks before that |
| Went dark | No order in the 60 days after the snapshot |
| Flagged at risk | Top 20% of active sellers by model risk score |
| GMV growth by state | GMV Apr to Jun 2018 / GMV Jan to Mar 2018, minus 1 |

## Calling a group above or below the team

Rates carry 90% Wilson score intervals (`growth/stats.py`). A group is called above or below the team rate
only when its whole interval clears the team rate and it has at least 15 deals. Smaller groups are shown
but labeled "too few to call".

## GMV

GMV is the item `price` from order items, on orders whose status is not `canceled` or `unavailable`.
Freight is excluded because the seller doesn't keep it. Currency is Brazilian reais (R$).
