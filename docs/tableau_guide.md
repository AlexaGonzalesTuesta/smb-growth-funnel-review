# Build the region view in Tableau Public (free), then embed it in the live page

Time: about 30 minutes. Result: a published Tableau dashboard of the seller book by Brazilian state, shown
inside the Regions tab of the live demo, and a Tableau Public profile link for your resume.

You need the repo on your laptop (you'll use `data\tableau\state_book.csv`). That file is rebuilt by
`python -m growth.build`, so it always matches the live page.

If any menu below looks different on your screen, stop and take a screenshot of what you see.

## 1. Install Tableau Public

1. Go to https://public.tableau.com and click **Sign Up**. Create a free profile.
2. Go to https://www.tableau.com/products/public/download, enter your email, click **Download the App**, and run the installer.
3. Open **Tableau Public** and sign in with the profile from step 1 if asked.

## 2. Connect to the data

1. On the start page, in the left **Connect** pane, under **To a File**, click **Text file**.
2. Browse to your repo folder, then `data` > `tableau` > `state_book.csv`, and click **Open**.
3. Check the preview: you should see 15 rows, starting with São Paulo. Click the **Sheet 1** tab at the bottom left.

## 3. Sheet 1: the map

1. In the **Data** pane on the left, right-click **Country** > **Geographic Role** > **Country/Region**.
2. Right-click **State Name** > **Geographic Role** > **State/Province**.
3. Double-click **State Name**. A map of Brazil with dots appears.
   If the bottom right says "unknown", click it > **Edit Locations** > set **Country/Region** to **From field: Country** > **OK**.
4. In the **Marks** card, change the dropdown from **Automatic** to **Map**.
5. Drag **GMV Last 16 Weeks** onto **Color** in the Marks card.
6. Click **Color** > **Edit Colors** > Palette **Green** > **OK**.
7. Drag **Enough Sellers** onto the **Filters** shelf, uncheck **Fewer than 10**, click **OK**.
8. Drag **Active Sellers**, **GMV Growth Q2 vs Q1**, **Flagged At Risk**, **Flagged Share** and **Went Dark Share** onto **Tooltip** in the Marks card.
9. Number formats, in the Data pane:
   - Right-click **GMV Last 16 Weeks** > **Default Properties** > **Number Format** > **Currency (Custom)**: Decimal places 0, Display Units **Thousands (K)**, Prefix/Suffix: type `R$` in Prefix > **OK**.
   - Right-click **GMV Growth Q2 vs Q1** > **Default Properties** > **Number Format** > **Percentage**, Decimal places 0 > **OK**. Do the same for **Flagged Share** and **Went Dark Share**.
10. Double-click the **Sheet 1** tab at the bottom and rename it `Seller book map`.

## 4. Sheet 2: at-risk share by state

1. Click the **New Worksheet** icon at the bottom (the first small icon to the right of the sheet tabs).
2. Drag **State Name** onto **Rows** and **Flagged Share** onto **Columns**.
3. Drag **Enough Sellers** onto **Filters**, keep only **10+ sellers**, **OK**.
4. Click the **Sort Descending** button in the toolbar.
5. Drag **GMV Growth Q2 vs Q1** onto **Color**. Click **Color** > **Edit Colors** > Palette **Red-Green Diverging** > click **Advanced >>** > check **Center** and type `0` > **OK**.
6. Drag **Flagged At Risk** onto **Label**.
7. Rename the sheet `At risk by state`.

## 5. The dashboard

1. Click the **New Dashboard** icon at the bottom (the second small icon).
2. In the left **Dashboard** pane, under **Size**, pick **Fixed size**, width `1100`, height `700`.
3. Drag `Seller book map` onto the canvas. Drag `At risk by state` onto the right half of the canvas.
4. Click the map on the dashboard, then click the small funnel icon (**Use as Filter**) at its top right. Now clicking a state filters the bar chart.
5. Menu **Dashboard** > **Show Title**. Double-click the title and type `Olist active seller book by state, June 30, 2018`.
6. Rename the dashboard tab `Seller book`.

## 6. Publish

1. Menu **File** > **Save to Tableau Public As...**, name it `Olist seller book by state`, click **Save**.
2. Your browser opens the published dashboard. Its address looks like
   `https://public.tableau.com/app/profile/your-name/viz/Olistsellerbookbystate/Sellerbook`.
3. Build the embed address: keep only the part after `/viz/` and put `https://public.tableau.com/views/` in front of it:
   `https://public.tableau.com/views/Olistsellerbookbystate/Sellerbook`

## 7. Show it in the live page

1. Open `site\config.js` in Notepad.
2. Paste the embed address between the quotes after `tableauUrl:` and save.
3. Commit and push (run each line on its own in Command Prompt, from the repo folder):
   ```
   git add site/config.js
   git commit -m "Embed Tableau Public view"
   git pull
   git push
   ```
4. Wait about two minutes for the **Deploy live demo to GitHub Pages** action to finish, then open the Regions tab. The Tableau view appears under the tile map.
