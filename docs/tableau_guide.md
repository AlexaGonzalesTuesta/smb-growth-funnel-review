# Build the seller book dashboard in Tableau, then show it on the live page

Time: about 45 minutes. Result: a published Tableau Public dashboard of the June 30, 2018 seller book
(a map of Brazil, at-risk share by state, and the at-risk seller list), shown in its own **Tableau dashboard**
tab on the live page, with a **Tableau dashboard** button in the page header.

Data source: `data\tableau\seller_book.csv`, one row per active seller (915 rows). It is written by
`python -m growth.build`, so its numbers always match the live page.

If any menu below looks different on your screen, stop and send a screenshot of what you see.

## 1. Connect to the data

1. Open Tableau (Tableau Public or Tableau Desktop both work).
2. On the start page, in the left **Connect** pane, under **To a File**, click **Text file**.
3. Browse to your repo folder > `data` > `tableau` > `seller_book.csv` and click **Open**.
4. Check the preview: 915 rows, columns from **Seller ID** to **GMV Next 60 Days**.
5. Click the **Sheet 1** tab at the bottom left.

## 2. Create six calculated fields

For each one: menu **Analysis** > **Create Calculated Field...**, type the name in the top box, paste the formula, click **OK**.

| Name | Formula |
|---|---|
| `Active Sellers` | `COUNTD([Seller ID])` |
| `Flagged Sellers` | `SUM(IF [Flagged] = "Yes" THEN 1 ELSE 0 END)` |
| `Share Flagged` | `[Flagged Sellers] / [Active Sellers]` |
| `GMV at Risk` | `SUM(IF [Flagged] = "Yes" THEN [GMV Last 16 Weeks] ELSE 0 END)` |
| `Flagged Hit Rate` | `SUM(IF [Flagged] = "Yes" AND [Went Dark] = "Yes" THEN 1 ELSE 0 END) / [Flagged Sellers]` |
| `Sellers In State` | `{ FIXED [State Name] : COUNTD([Seller ID]) }` |

Then set number formats in the **Data** pane on the left:
- Right-click **Share Flagged** > **Default Properties** > **Number Format...** > **Percentage**, Decimal places `0` > **OK**. Do the same for **Flagged Hit Rate** and **Risk Score**.
- Right-click **GMV at Risk** > **Default Properties** > **Number Format...** > **Currency (Custom)**: Decimal places `0`, Display Units **Thousands (K)**, Prefix `R$` > **OK**. Do the same for **GMV Last 16 Weeks**.

## 3. Sheet 1: map

1. In the **Data** pane, right-click **Country** > **Geographic Role** > **Country/Region**.
2. Right-click **State Name** > **Geographic Role** > **State/Province**.
3. Double-click **State Name**. A map of Brazil appears.
   If the bottom right of the map says "unknown", click it > **Edit Locations...** > **Country/Region**: choose **From field** > **Country** > **OK**.
4. In the **Marks** card, change the dropdown from **Automatic** to **Map**.
5. Drag **GMV at Risk** onto **Color** in the Marks card. Click **Color** > **Edit Colors...** > Palette **Red** > **OK**.
6. Drag **Active Sellers**, **Flagged Sellers**, **Share Flagged** and **Flagged Hit Rate** onto **Tooltip** in the Marks card.
7. Double-click the **Sheet 1** tab and rename it `Map`.

## 4. Sheet 2: at-risk share by state

1. Click the **New Worksheet** icon at the bottom (the first small icon right of the sheet tabs).
2. Drag **State Name** onto **Rows** and **Share Flagged** onto **Columns**.
3. Drag **Sellers In State** onto **Filters**. In the box that opens, choose **All values** > **Next**, set the minimum to `10` > **OK**. This hides states with too few sellers to trust a percentage.
4. Click the **Sort Descending** button in the toolbar.
5. Drag **Flagged Sellers** onto **Label** in the Marks card.
6. Drag **GMV at Risk** onto **Color**, then **Color** > **Edit Colors...** > Palette **Red** > **OK**.
7. Rename the sheet `States`.

## 5. Sheet 3: at-risk seller list

1. New worksheet. Drag **Flagged** onto **Filters**, check only **Yes** > **OK**.
2. Drag these onto **Rows**, in this order: **Seller ID**, **City**, **Main Category**, **Main Reason**, **Went Dark**.
3. Double-click **GMV Last 16 Weeks**, then **Days Since Last Sale**, then **Risk Score**. Tableau builds a text table with those three numbers.
4. Click the **Seller ID** pill on Rows > **Sort...** > Sort By **Field**, Field Name **Risk Score**, Aggregation **Sum**, **Descending** > close the box.
5. Rename the sheet `At-risk sellers`.

## 6. The dashboard

1. Click the **New Dashboard** icon at the bottom (the second small icon).
2. In the left **Dashboard** pane, under **Size**, choose **Fixed size**, width `1200`, height `760`.
3. Drag **Map** onto the canvas. Drag **States** onto the right half of the map. Drag **At-risk sellers** onto the bottom edge so it spans the full width.
4. Click the map on the dashboard, then click the small funnel icon at its top right (**Use as Filter**). Do the same on **States**. Now clicking a state filters the seller list.
5. Menu **Dashboard** > **Show Title**. Double-click the title and type `Olist seller book, June 30, 2018: who is about to stop selling`.
6. Rename the dashboard tab `Seller book`.
7. Click a state on the map to check that the seller list filters, then click the state again to clear it.

## 7. Publish to Tableau Public

1. Save it to Tableau Public:
   - In **Tableau Public**: menu **File** > **Save to Tableau Public As...**
   - In **Tableau Desktop**: menu **Server** > **Tableau Public** > **Save to Tableau Public As...**
2. Sign in (create a free profile at https://public.tableau.com if you don't have one), name it `Olist seller book`, click **Save**.
3. Your browser opens the published dashboard. Copy the full address from the address bar and send it to me. It looks like `https://public.tableau.com/app/profile/.../viz/Olistsellerbook/Sellerbook`.

I'll convert it to the embed address, add it to `site/config.js` and the README, and the **Tableau dashboard** tab and header button will appear on the live page.
