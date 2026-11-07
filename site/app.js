/* New-seller growth review. Plain JavaScript, no build step. Reads data.json produced by `python -m growth.build`. */
(function () {
  "use strict";

  var STORE = "sgr:v1";
  var D = null;            // the data payload
  var BASE = null;         // baseline lever values
  var S = null;            // this visitor's state (saved in their browser only)
  var RISK_PAGE = 25;

  // ---------- formatting ----------
  var nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  function n0(x) { return nf0.format(Math.round(x)); }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + "%"; }
  function money(x) {
    var a = Math.abs(x);
    if (a >= 1e6) return "R$" + (x / 1e6).toFixed(2) + "M";
    if (a >= 1e4) return "R$" + (x / 1e3).toFixed(0) + "K";
    return "R$" + n0(x);
  }
  function signed(x, f) { return (x >= 0 ? "+" : "−") + f(Math.abs(x)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function longDate(iso) {
    var m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var p = iso.split("-"); return m[+p[1] - 1] + " " + (+p[2]) + ", " + p[0];
  }
  function addDays(iso, days) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }

  // ---------- state ----------
  function defaults() {
    return { levers: Object.assign({}, BASE), target: 30, tab: "model", scenario: null, sellerTab: "leadtype",
             metric: "gmv", stateFilter: "all", reveal: false, shown: RISK_PAGE, sort: { key: "risk", dir: -1 }, selected: null };
  }
  function load() {
    try { var raw = localStorage.getItem(STORE); if (raw) { var s = JSON.parse(raw); return Object.assign(defaults(), s); } } catch (e) { /* storage blocked: fall back to memory */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  // ---------- tooltip ----------
  var tip = null;
  function bindTips(root) {
    root.addEventListener("mousemove", function (e) {
      var t = e.target.closest("[data-tip]");
      if (!t) { tip.hidden = true; return; }
      tip.innerHTML = t.getAttribute("data-tip");
      tip.hidden = false;
      var x = e.clientX + 14, y = e.clientY + 14;
      var w = tip.offsetWidth, h = tip.offsetHeight;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
      tip.style.left = x + "px"; tip.style.top = y + "px";
    });
    root.addEventListener("mouseleave", function () { tip.hidden = true; });
  }

  // ---------- driver tree ----------
  var LEVERS = [
    { key: "leads", name: "Leads", fmt: function (v) { return n0(v); }, min: function () { return Math.round(BASE.leads * 0.5); }, max: function () { return Math.round(BASE.leads * 2); }, step: 1 },
    { key: "win_rate", name: "Win rate", fmt: function (v) { return pct(v); }, min: function () { return 0.02; }, max: function () { return 0.30; }, step: 0.001 },
    { key: "activation_rate", name: "Activation rate", fmt: function (v) { return pct(v); }, min: function () { return 0.10; }, max: function () { return 0.90; }, step: 0.001 },
    { key: "gmv_per_active", name: "GMV per activated seller", fmt: function (v) { return money(v); }, min: function () { return 300; }, max: function () { return 3000; }, step: 10 }
  ];
  function gmvOf(l) { return l.leads * l.win_rate * l.activation_rate * l.gmv_per_active; }

  function benchmarks() {
    var ch = D.channels.filter(function (c) { return c.key !== "unknown" && c.leads >= 100; });
    var bestWin = ch.slice().sort(function (a, b) { return b.win_rate - a.win_rate; })[0];
    var groups = [].concat(D.lead_types, D.business_types, D.segments).filter(function (g) { return g.deals >= 30; });
    var bestAct = groups.slice().sort(function (a, b) { return b.activation_rate - a.activation_rate; })[0];
    var paid = D.channels.find(function (c) { return c.key === "paid_search"; });
    return {
      win: bestWin, act: bestAct, paid: paid,
      text: {
        leads: "+10% = " + n0(BASE.leads * 0.1) + " more leads",
        win_rate: "Best source: " + pct(bestWin.win_rate),
        activation_rate: "Paid search: " + pct(paid.activation_rate, 0),
        gmv_per_active: "Median seller: " + money(D.concentration.median_gmv_active)
      }
    };
  }

  function renderEquation() {
    var eq = $("equation"), bm = benchmarks();
    var html = "";
    LEVERS.forEach(function (L, i) {
      var v = S.levers[L.key], changed = Math.abs(v - BASE[L.key]) > 1e-9;
      html += '<div class="term' + (changed ? " changed" : "") + '" data-lever="' + L.key + '">' +
        '<label class="term-name" for="lv-' + L.key + '">' + L.name + "</label>" +
        '<div class="term-value">' + L.fmt(v) + "</div>" +
        '<div class="term-base">' + (changed ? "Actual " + L.fmt(BASE[L.key]) : "Actual") + "</div>" +
        '<input type="range" id="lv-' + L.key + '" min="' + L.min() + '" max="' + L.max() + '" step="' + L.step + '" value="' + v + '" aria-valuetext="' + esc(L.fmt(v)) + '">' +
        '<div class="term-bench" title="' + esc(bm.text[L.key]) + '">' + esc(bm.text[L.key]) + "</div></div>";
      html += '<div class="op" aria-hidden="true">' + (i < 3 ? "×" : "=") + "</div>";
    });
    var g = gmvOf(S.levers), base = D.tree.gmv, dlt = g / base - 1;
    html += '<div class="term result" aria-live="polite"><span class="term-name">New-seller GMV, first 90 days</span>' +
      '<div class="term-value">' + money(g) + "</div>" +
      (Math.abs(dlt) > 0.0005 ? '<div class="delta ' + (dlt > 0 ? "up" : "down") + '">' + signed(dlt, function (x) { return pct(x); }) + " vs actual " + money(base) + "</div>"
        : '<div class="term-base">' + n0(D.summary.activated) + " sellers made a first sale</div>") + "</div>";
    eq.innerHTML = html;
    LEVERS.forEach(function (L) {
      $("lv-" + L.key).addEventListener("input", function (e) {
        S.levers[L.key] = parseFloat(e.target.value); S.scenario = null; save();
        updateEquationValues();
      });
    });
    renderScenarioButtons(); renderTarget();
  }
  function updateEquationValues() {
    // Update text in place so the slider being dragged keeps focus.
    LEVERS.forEach(function (L) {
      var box = document.querySelector('.term[data-lever="' + L.key + '"]'), v = S.levers[L.key];
      var changed = Math.abs(v - BASE[L.key]) > 1e-9;
      box.classList.toggle("changed", changed);
      box.querySelector(".term-value").textContent = L.fmt(v);
      box.querySelector(".term-base").textContent = changed ? "Actual " + L.fmt(BASE[L.key]) : "Actual";
      var inp = $("lv-" + L.key); inp.setAttribute("aria-valuetext", L.fmt(v)); if (+inp.value !== v) inp.value = v;
    });
    var g = gmvOf(S.levers), base = D.tree.gmv, dlt = g / base - 1;
    var r = document.querySelector(".term.result");
    r.innerHTML = '<span class="term-name">New-seller GMV, first 90 days</span><div class="term-value">' + money(g) + "</div>" +
      (Math.abs(dlt) > 0.0005 ? '<div class="delta ' + (dlt > 0 ? "up" : "down") + '">' + signed(dlt, function (x) { return pct(x); }) + " vs actual " + money(base) + "</div>"
        : '<div class="term-base">' + n0(D.summary.activated) + " sellers made a first sale</div>");
    renderScenarioButtons();
  }

  function isBase() { return LEVERS.every(function (L) { return Math.abs(S.levers[L.key] - BASE[L.key]) < 1e-9; }); }
  function applyScenario(id) {
    var sc = D.scenarios.find(function (x) { return x.id === id; });
    S.levers = Object.assign({}, BASE, sc ? sc.changes : {}); S.scenario = sc ? sc.id : null; save();
    updateEquationValues();
  }
  function renderScenarioButtons() {
    var sel = $("scenario");
    var cur = S.scenario || (isBase() ? "" : "custom");
    sel.innerHTML = '<option value="">Scenario: Actual</option>' + D.scenarios.map(function (sc) {
      return '<option value="' + sc.id + '">' + esc(sc.title) + "</option>";
    }).join("") + (cur === "custom" ? '<option value="custom">Custom (your changes)</option>' : "");
    sel.value = cur;
    var sc = D.scenarios.find(function (x) { return x.id === S.scenario; });
    $("scenario-note").textContent = sc ? sc.what + " Result: " + signed(sc.pct_change, function (x) { return pct(x); }) + " new-seller GMV." : "";
  }

  function renderTarget() {
    var inp = $("target-input");
    if (!inp) return;
    if (document.activeElement !== inp) inp.value = S.target;
    var t = S.target, out = $("target-readout");
    if (!t || t <= 0 || t > 300 || isNaN(t)) { out.innerHTML = '<p class="readout-title">Type a target between 1% and 300% to see what each driver would need.</p>'; return; }
    var factor = 1 + t / 100, bm = benchmarks();
    var need = {};
    LEVERS.forEach(function (L) { need[L.key] = BASE[L.key] * factor; });
    function check(ok, okText, noText) { return ok ? '<span class="real">' + okText + "</span>" : '<span class="stretch">' + noText + "</span>"; }
    var cells = [
      '<div class="need">Leads alone<b>' + n0(need.leads) + "</b>" + "+" + n0(need.leads - BASE.leads) + " leads at today's rates</div>",
      '<div class="need">Win rate alone<b>' + pct(need.win_rate) + "</b>" + check(need.win_rate <= bm.win.win_rate, "Seen in the data: " + bm.win.label.toLowerCase() + " wins " + pct(bm.win.win_rate), "Higher than any tracked source wins today") + "</div>",
      '<div class="need">Activation alone<b>' + (need.activation_rate > 1 ? "over 100%" : pct(need.activation_rate)) + "</b>" + check(need.activation_rate <= bm.act.activation_rate, "Seen in the data: " + bm.act.label.toLowerCase() + " activate " + pct(bm.act.activation_rate, 0), "Higher than any seller group activates today") + "</div>",
      '<div class="need">GMV per activated seller alone<b>' + money(need.gmv_per_active) + "</b>Depends on signing a few large sellers</div>"
    ];
    out.innerHTML = '<p class="readout-title">To grow new-seller GMV ' + t + "%, any one of these on its own would get there:</p>" + cells.join("");
  }

  // ---------- leak strip ----------
  function renderLeak() {
    if (!$("leak-strip")) return;
    var s = D.summary;
    var stages = [
      { n: n0(s.leads), what: "Leads, Jan to Apr 2018", w: 1, lost: "" },
      { n: n0(s.won), what: "Signed by May 31 (" + pct(s.win_rate) + ")", w: s.won / s.leads, lost: n0(s.leads - s.won) + " leads never signed" },
      { n: n0(s.activated), what: "Made a first sale within 90 days (" + pct(s.activation_rate) + ")", w: s.activated / s.leads, lost: n0(s.never_sold) + " signed sellers never sold, the leak sales can still fix", big: true },
      { n: money(s.gmv), what: "GMV from those sellers in their first 90 days", w: null, lost: "", extra: money(s.gmv_per_active) + " per seller on average, median " + money(D.concentration.median_gmv_active) }
    ];
    $("leak-strip").innerHTML = stages.map(function (st) {
      return '<div class="stage' + (st.big ? " biggest" : "") + '"><div class="n">' + st.n + '</div><div class="what">' + st.what + "</div>" +
        (st.w != null ? '<div class="bar" style="width:' + Math.max(st.w * 100, 0.6) + '%" aria-hidden="true"></div>' : "") +
        (st.lost ? '<div class="lost">' + st.lost + "</div>" : "") + (st.extra ? '<div class="what">' + st.extra + "</div>" : "") + "</div>";
    }).join("");
  }

  // ---------- side navigation ----------
  var ICON = {
    model: '<path d="M2.5 13.5h11"/><path d="M4.5 11V7.5M8 11V4M11.5 11V6"/>',
    findings: '<path d="M3 3.5h10M3 8h10M3 12.5h6"/>',
    channels: '<path d="M2.5 3h11l-4.2 5v4.5l-2.6 1V8z"/>',
    sellers: '<path d="M2.5 6.5l1-3.5h9l1 3.5"/><path d="M2.5 6.5h11v7h-11z"/><path d="M6.5 13.5v-3.5h3v3.5"/>',
    reps: '<circle cx="8" cy="5.5" r="2.7"/><path d="M3 13.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4"/>',
    regions: '<path d="M8 14s-4.5-4.2-4.5-7.5a4.5 4.5 0 0 1 9 0C12.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>',
    risk: '<path d="M8 2.5l6 10.5H2z"/><path d="M8 6.8v3M8 11.6v.1"/>',
    tableau: '<path d="M8 2v4M8 10v4M2 8h4M10 8h4M4.5 4.5l1.5 1.5M10 10l1.5 1.5M11.5 4.5L10 6M6 10l-1.5 1.5"/>',
    method: '<circle cx="8" cy="8" r="5.8"/><path d="M8 7.3v4M8 4.8v.1"/>'
  };
  var TABS = [
    ["model", "Growth model"], ["findings", "Findings"], null,
    ["channels", "Lead sources"], ["sellers", "Seller types"], ["reps", "Reps"], ["regions", "Regions"], ["risk", "At-risk sellers"], null,
    ["tableau", "Tableau"], ["method", "Method"]
  ];
  function pages() { return TABS.filter(function (t) { return t && (t[0] !== "tableau" || tableauUrl()); }); }
  function tableauUrl() { var u = (window.REVIEW_CONFIG || {}).tableauUrl; return u && /^https:\/\/public\.tableau\.com\//.test(u) ? u : ""; }
  function renderTabs() {
    var nav = $("nav"), html = "";
    TABS.forEach(function (t) {
      if (!t) { html += '<div class="rule" role="presentation"></div>'; return; }
      if (t[0] === "tableau" && !tableauUrl()) return;
      var badge = t[0] === "risk" && D ? '<span class="count" title="Sellers flagged">' + D.at_risk.length + "</span>" : "";
      html += '<a href="#' + t[0] + '" data-tab="' + t[0] + '"' + (S.tab === t[0] ? ' aria-current="page"' : "") + '><svg viewBox="0 0 16 16" aria-hidden="true">' + ICON[t[0]] + "</svg>" + t[1] + badge + "</a>";
    });
    nav.innerHTML = html;
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); selectTab(a.dataset.tab); });
    });
    showPanel();
  }
  function selectTab(id, keepScroll) {
    S.tab = id; save();
    if (location.hash !== "#" + id) history.pushState(null, "", "#" + id);
    renderTabs();
    if (!keepScroll) window.scrollTo(0, 0);
  }
  function showPanel() {
    if (!pages().some(function (t) { return t[0] === S.tab; })) S.tab = "model";
    pages().forEach(function (t) { var el = $("panel-" + t[0]); if (el) el.hidden = t[0] !== S.tab; });
    var cur = pages().filter(function (t) { return t[0] === S.tab; })[0];
    document.title = cur[1] + " | Seller Growth Review";
    if (S.tab === "tableau") loadTableau();
  }
  window.addEventListener("popstate", function () {
    var h = location.hash.replace("#", "");
    if (S && pages().some(function (t) { return t[0] === h; })) { S.tab = h; save(); renderTabs(); }
  });
  function loadTableau() {
    var url = tableauUrl(), box = $("tableau-frame");
    if (!url || box.querySelector("iframe")) return;
    var src = url + (url.indexOf("?") > 0 ? "&" : "?") + ":showVizHome=no&:embed=true&:display_count=no";
    box.innerHTML = '<iframe title="Seller book dashboard in Tableau Public" src="' + esc(src) + '"></iframe>';
  }
  // ---------- overflow menu: every secondary action lives here ----------
  var closeMenu = null;
  document.addEventListener("mousedown", function (e) { if (closeMenu) closeMenu(e); });
  function renderMenu() {
    var wrap = $("more"), menu = null, btn;
    wrap.innerHTML = "";
    function close(focusBtn) { if (menu) { menu.remove(); menu = null; btn.setAttribute("aria-expanded", "false"); if (focusBtn) btn.focus(); } }
    function item(label, fn) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "menuitem"); b.tabIndex = -1; b.textContent = label;
      b.addEventListener("click", function () { close(false); fn(); });
      return b;
    }
    function link(label, href) {
      var a = document.createElement("a");
      a.setAttribute("role", "menuitem"); a.tabIndex = -1; a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = label + " \u2197";
      return a;
    }
    function div(cls, text) { var d = document.createElement("div"); d.className = cls; if (text) d.textContent = text; return d; }
    function open() {
      menu = div("menu"); menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "More actions");
      var best = D.scenarios.find(function (x) { return x.id === "paid_level"; }) || D.scenarios[0];
      var pr = D.states.find(function (x) { return x.state === "PR"; });
      [div("group", "Guided tour"),
        item(best.title, function () { selectTab("model"); applyScenario(best.id); }),
        item("Which lead sources activate best", function () { selectTab("channels"); }),
        pr ? item("Open " + pr.name + "'s at-risk sellers", function () { S.selected = "PR"; S.stateFilter = "PR"; S.shown = RISK_PAGE; save(); renderRegions(); renderRiskControls(); renderRisk(); selectTab("risk"); }) : null,
        item("Check the at-risk list against what happened", function () { S.reveal = true; save(); renderRiskControls(); renderRisk(); selectTab("risk"); }),
        div("sep"),
        item("Reset my changes", resetAll),
        tableauUrl() ? link("Open in Tableau Public", (window.REVIEW_CONFIG || {}).tableauPage || tableauUrl()) : null,
        link("Code on GitHub", "https://github.com/AlexaGonzalesTuesta/smb-growth-funnel-review")
      ].forEach(function (n) { if (n) menu.appendChild(n); });
      menu.addEventListener("keydown", function (e) {
        var list = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
        var i = list.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
        else if (e.key === "Escape") { e.preventDefault(); close(true); }
        else if (e.key === "Tab") close(false);
      });
      wrap.appendChild(menu);
      btn.setAttribute("aria-expanded", "true");
      menu.querySelector('[role="menuitem"]').focus();
    }
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "dots"; btn.textContent = "\u00b7\u00b7\u00b7";
    btn.setAttribute("aria-label", "More actions"); btn.setAttribute("aria-haspopup", "menu"); btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", function () { menu ? close(false) : open(); });
    wrap.appendChild(btn);
    closeMenu = function (e) { if (menu && !wrap.contains(e.target)) close(false); };
  }
  function resetAll() {
    var keepTab = S ? S.tab : "model";
    try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    S = defaults(); S.tab = keepTab; save(); renderAll();
  }

  // ---------- small SVG helpers ----------
  function svg(w, h, inner, label) { return '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(label) + '">' + inner + "</svg>"; }

  function dotCI(rows, ref, opts) {
    // Horizontal dot + interval chart, 0-100%. rows: {label, value, lo, hi, n, call}
    opts = opts || {};
    var W = 560, rowH = 28, L = opts.labelW || 190, R = 64, top = 22, H = top + rows.length * rowH + 8;
    var x = function (v) { return L + v * (W - L - R); };
    var g = '<g class="grid">';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) { g += '<line x1="' + x(t) + '" x2="' + x(t) + '" y1="' + (top - 6) + '" y2="' + (H - 6) + '"/><text x="' + x(t) + '" y="12" text-anchor="middle">' + (t * 100) + "%</text>"; });
    g += "</g>";
    var body = "";
    rows.forEach(function (r, i) {
      var y = top + i * rowH + rowH / 2;
      var col = r.call === "below" ? "var(--accent)" : r.call === "above" ? "var(--ink)" : "var(--faint)";
      var tipTxt = "<b>" + esc(r.label) + "</b><br>" + pct(r.value) + " activated (" + r.k + " of " + r.n + ")<br>90% interval " + pct(r.lo, 0) + " to " + pct(r.hi, 0) +
        "<br>" + (r.call === "small" ? "Too few deals to call" : r.call === "in line" ? "In line with the team" : (r.call === "above" ? "Above" : "Below") + " the team rate");
      body += '<g class="row" data-tip="' + esc(tipTxt) + '"><rect class="rowbg" x="0" y="' + (y - rowH / 2) + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>' +
        '<text x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(r.label) + "</text>" +
        '<line class="mark" x1="' + x(r.lo) + '" x2="' + x(r.hi) + '" y1="' + y + '" y2="' + y + '" stroke="' + col + '" stroke-width="2" stroke-linecap="round"/>' +
        '<circle class="mark" cx="' + x(r.value) + '" cy="' + y + '" r="5" fill="' + col + '" stroke="#fff" stroke-width="2"/>' +
        '<text x="' + (W - R + 10) + '" y="' + (y + 4) + '" style="fill:var(--ink)">' + pct(r.value, 0) + '</text></g>';
    });
    var refLine = '<line class="ref" x1="' + x(ref) + '" x2="' + x(ref) + '" y1="' + (top - 6) + '" y2="' + (H - 6) + '"/>' +
      '<text x="' + (x(ref) + 4) + '" y="' + (H + 6) + '" style="fill:var(--ink)">Team ' + pct(ref, 0) + "</text>";
    return svg(W, H + 12, g + body + refLine, opts.label || "Activation by group");
  }

  function hbars(rows, opts) {
    // rows: {label, value, fmt, highlight}
    var W = 560, rowH = 34, L = opts.labelW || 230, R = 96, H = rows.length * rowH + 6;
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }));
    var x = function (v) { return (v / max) * (W - L - R); };
    var body = rows.map(function (r, i) {
      var y = i * rowH + 6, h = 16;
      return '<g class="row" data-tip="' + esc(r.tip || r.label) + '"><rect class="rowbg" x="0" y="' + (y - 6) + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>' +
        '<text x="' + (L - 10) + '" y="' + (y + 12) + '" text-anchor="end">' + esc(r.label) + "</text>" +
        '<rect class="mark" x="' + L + '" y="' + y + '" width="' + Math.max(x(r.value), 2) + '" height="' + h + '" rx="2" fill="' + (r.highlight ? "var(--ink-2)" : "var(--faint)") + '"/>' +
        '<text x="' + (L + x(r.value) + 8) + '" y="' + (y + 12) + '" style="fill:var(--ink)">' + r.fmt + "</text></g>";
    }).join("");
    return svg(W, H, body, opts.label);
  }

  function vbars(rows, opts) {
    var W = 560, H = 190, B = 26, T = 18, gap = 18;
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }));
    var bw = (W - gap * (rows.length - 1)) / rows.length;
    var body = rows.map(function (r, i) {
      var h = (r.value / max) * (H - B - T), x = i * (bw + gap), y = H - B - h;
      return '<g class="row" data-tip="' + esc(r.tip) + '"><rect class="rowbg" x="' + x + '" y="0" width="' + bw + '" height="' + H + '" fill="transparent"/>' +
        '<rect class="mark" x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="2" fill="var(--ink-2)"/>' +
        '<text x="' + (x + bw / 2) + '" y="' + (y - 6) + '" text-anchor="middle" style="fill:var(--ink)">' + r.value + "</text>" +
        '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(r.label) + "</text></g>";
    }).join("");
    return svg(W, H, '<line x1="0" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--hair)"/>' + body, opts.label);
  }

  // ---------- findings ----------
  function renderFindings() {
    $("findings").innerHTML = D.findings.map(function (f, i) {
      return '<li><div><div class="t">' + esc(f.title) + "</div><p>" + esc(f.detail) + '</p><div class="action">' + esc(f.action) + "</div></div></li>";
    }).join("");
    var tb = D.timing.buckets, total = tb.reduce(function (a, b) { return a + b.count; }, 0);
    $("timing-chart").innerHTML = vbars(tb.map(function (b) {
      return { label: b.label, value: b.count, tip: "<b>" + esc(b.label) + "</b><br>" + b.count + " sellers (" + pct(b.count / total, 0) + " of activated)" };
    }), { label: "Days from signing to first sale" });
    var rows = [{ label: "Actual", value: D.tree.gmv, fmt: money(D.tree.gmv), tip: "<b>Actual</b><br>" + money(D.tree.gmv) }].concat(D.scenarios.map(function (s) {
      return { label: s.title, value: s.gmv, fmt: money(s.gmv) + "  " + signed(s.pct_change, function (x) { return pct(x, 0); }), highlight: true, tip: "<b>" + esc(s.title) + "</b><br>" + esc(s.what) + "<br>" + money(s.gmv) };
    }));
    $("scenario-chart").innerHTML = hbars(rows, { label: "GMV by scenario", labelW: 250 });
  }

  // ---------- channels ----------
  function miniCI(r) {
    if (r.activation_rate == null) return '<span class="muted">No signed sellers</span>';
    var W = 120, x = function (v) { return 4 + v * (W - 8); };
    var ref = D.summary.activation_rate;
    var col = r.act_call === "below" ? "var(--accent)" : r.act_call === "above" ? "var(--ink)" : "var(--faint)";
    return '<svg viewBox="0 0 ' + W + ' 16" width="' + W + '" height="16" aria-hidden="true" style="vertical-align:middle">' +
      '<line x1="4" x2="' + (W - 4) + '" y1="8" y2="8" stroke="var(--hair)"/>' +
      '<line x1="' + x(ref) + '" x2="' + x(ref) + '" y1="1" y2="15" stroke="var(--ink)" stroke-dasharray="2 2"/>' +
      '<line x1="' + x(r.act_ci[0]) + '" x2="' + x(r.act_ci[1]) + '" y1="8" y2="8" stroke="' + col + '" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="' + x(r.activation_rate) + '" cy="8" r="4" fill="' + col + '" stroke="#fff" stroke-width="1.5"/></svg> ' + pct(r.activation_rate, 0);
  }
  function callTag(c) { return c === "small" ? '<span class="call">Too few to call</span>' : '<span class="call ' + c.replace(" ", "-") + '">' + (c === "in line" ? "In line" : c === "above" ? "Above team" : "Below team") + "</span>"; }
  function renderChannels() {
    var head = "<thead><tr><th>Lead source</th><th class=num>Leads</th><th class=num>Win rate</th><th class=num>Signed</th><th>Activation, 90% interval</th><th>Call</th><th class=num>GMV per lead</th><th class=num>Share of GMV</th></tr></thead>";
    var body = D.channels.map(function (c) {
      return "<tr><td>" + esc(c.label) + "</td><td class=num>" + n0(c.leads) + "</td><td class=num>" + pct(c.win_rate) + "</td><td class=num>" + n0(c.won) +
        '</td><td class="ci-cell" data-tip="' + esc("<b>" + c.label + "</b><br>" + c.activated + " of " + c.won + " signed sellers made a first sale") + '">' + miniCI(c) + "</td><td>" + callTag(c.act_call) +
        "</td><td class=num>" + money(c.gmv_per_lead) + "</td><td class=num>" + pct(c.share_of_gmv, 0) + "</td></tr>";
    }).join("");
    var s = D.summary;
    var foot = "<tfoot><tr><td><b>All leads</b></td><td class=num><b>" + n0(s.leads) + "</b></td><td class=num><b>" + pct(s.win_rate) + "</b></td><td class=num><b>" + n0(s.won) + "</b></td><td><b>" + pct(s.activation_rate, 0) +
      "</b> team rate (dashed line)</td><td></td><td class=num><b>" + money(s.gmv / s.leads) + "</b></td><td class=num><b>100%</b></td></tr></tfoot>";
    $("channel-table").innerHTML = head + "<tbody>" + body + "</tbody>" + foot;
  }

  // ---------- seller types and reps ----------
  function asRows(list) { return list.map(function (g) { return { label: g.label, value: g.activation_rate, lo: g.ci[0], hi: g.ci[1], n: g.deals, k: g.activated, call: g.call }; }); }
  function renderSellers() {
    var ref = D.deals_activation_rate;
    $("leadtype-chart").innerHTML = dotCI(asRows(D.lead_types), ref, { label: "Activation by lead type" });
    var seg = D.business_types.concat(D.segments.filter(function (s) { return s.deals >= 15; }));
    $("segment-chart").innerHTML = dotCI(asRows(seg), ref, { label: "Activation by business type and segment" });
    var tabsEl = $("seller-tabs");
    tabsEl.innerHTML = [["leadtype", "Lead type"], ["segment", "Business type and segment (15+ deals)"]].map(function (t) {
      return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (S.sellerTab === t[0]) + '">' + t[1] + "</button>";
    }).join("");
    tabsEl.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { S.sellerTab = b.dataset.t; save(); renderSellers(); }); });
    $("leadtype-chart").hidden = S.sellerTab !== "leadtype";
    $("segment-chart").hidden = S.sellerTab === "leadtype";
  }
  function renderReps() {
    var reps = D.reps.filter(function (r) { return r.deals >= 10; });
    $("reps-sub").textContent = reps.length + " reps with 10+ deals won by May 31, 2018";
    $("rep-chart").innerHTML = dotCI(reps.map(function (r) { return { label: r.rep + " (" + r.deals + " deals)", value: r.activation_rate, lo: r.ci[0], hi: r.ci[1], n: r.deals, k: r.activated, call: r.call }; }),
      D.deals_activation_rate, { label: "Activation by rep", labelW: 150 });
  }

  // ---------- regions ----------
  var TILES = { RR: [2, 0], AP: [3, 0], AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1], AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2],
    MT: [1, 3], DF: [2, 3], BA: [3, 3], SE: [4, 3], AL: [5, 3], MS: [1, 4], GO: [2, 4], MG: [3, 4], ES: [4, 4], PR: [1, 5], SP: [2, 5], RJ: [3, 5], SC: [1, 6], RS: [1, 7] };
  var NAMES = { AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
    MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins" };
  var SEQ = ["#EEEFF0", "#D6D8DB", "#B4B8BD", "#878C93", "#555A61", "#26292E"];
  var DIV = ["#A23A14", "#D9724A", "#F2C7B4", "#EEEFF0", "#B4B8BD", "#6E737A", "#26292E"];
  var MIN_SELLERS = 10;
  var METRICS = {
    gmv: { name: "GMV, last 16 weeks", get: function (s) { return s.gmv_last16w; }, fmt: money },
    growth: { name: "GMV growth, Q2 vs Q1", get: function (s) { return s.gmv_growth; }, fmt: function (v) { return v == null ? "n/a" : signed(v, function (x) { return pct(x, 0); }); } },
    flagged: { name: "Share flagged at risk", get: function (s) { return s.flagged_share; }, fmt: function (v) { return pct(v, 0); } }
  };
  function colorFor(metric, v, all) {
    if (v == null) return null;
    if (metric === "growth") {
      var cuts = [-0.2, -0.1, -0.03, 0.03, 0.1, 0.2];
      var i = 0; while (i < cuts.length && v > cuts[i]) i++; return DIV[i];
    }
    var vals = all.map(function (s) { return METRICS[metric].get(s); }).filter(function (x) { return x != null; });
    if (metric === "gmv") { var lo = Math.log(Math.min.apply(null, vals)), hi = Math.log(Math.max.apply(null, vals)); var t = (Math.log(v) - lo) / (hi - lo || 1); return SEQ[Math.min(5, Math.floor(t * 6))]; }
    var mx = Math.max.apply(null, vals) || 1; return SEQ[Math.min(5, Math.floor((v / mx) * 6))];
  }
  function renderRegions() {
    var bar = $("map-metric");
    bar.innerHTML = Object.keys(METRICS).map(function (k) { return '<button type="button" role="radio" aria-checked="' + (S.metric === k) + '" data-m="' + k + '">' + METRICS[k].name + "</button>"; }).join("");
    bar.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { S.metric = b.dataset.m; save(); renderRegions(); }); });
    var byState = {}; D.states.forEach(function (s) { byState[s.state] = s; });
    var enough = D.states.filter(function (s) { return s.active_sellers >= MIN_SELLERS; });
    var html = "";
    Object.keys(TILES).forEach(function (uf) {
      var p = TILES[uf], s = byState[uf], few = !s || s.active_sellers < MIN_SELLERS;
      var v = s ? METRICS[S.metric].get(s) : null, col = few ? null : colorFor(S.metric, v, enough);
      var dark = col && (["#878C93", "#555A61", "#26292E", "#A23A14", "#D9724A", "#6E737A"].indexOf(col) >= 0);
      var t = "<b>" + NAMES[uf] + "</b><br>" + (s ? s.active_sellers + " active sellers<br>" + METRICS[S.metric].name + ": " + METRICS[S.metric].fmt(v) : "No active sellers") + (few && s ? "<br>Too few sellers to color" : "");
      html += '<button type="button" class="tile' + (few ? " few" : "") + (dark ? " dark" : "") + '" style="grid-column:' + (p[0] + 1) + ";grid-row:" + (p[1] + 1) + ";" + (col ? "background:" + col : "") +
        '" data-uf="' + uf + '" aria-pressed="' + (S.selected === uf) + '" data-tip="' + esc(t) + '" aria-label="' + esc(NAMES[uf] + (s ? ", " + s.active_sellers + " active sellers" : ", no active sellers")) + '">' +
        '<span class="uf">' + uf + '</span><span class="v">' + (s && !few ? METRICS[S.metric].fmt(v) : s ? s.active_sellers + (s.active_sellers === 1 ? " seller" : " sellers") : "") + "</span></button>";
    });
    $("tile-map").innerHTML = html;
    $("tile-map").querySelectorAll(".tile").forEach(function (b) { b.addEventListener("click", function () { S.selected = b.dataset.uf; save(); renderRegions(); }); });
    var leg = S.metric === "growth"
      ? '<span>Decline</span><span class="ramp">' + DIV.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + "</span><span>Growth</span>"
      : '<span>Low</span><span class="ramp">' + SEQ.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + "</span><span>High" + (S.metric === "gmv" ? " (log scale)" : "") + "</span>";
    $("map-legend").innerHTML = leg + ' <span><i class="few-key"></i> Fewer than ' + MIN_SELLERS + " active sellers</span>";
    renderStateDetail(byState);
    renderStateTable();
  }
  function renderStateTable() {
    var head = "<thead><tr><th>State</th><th class=num>Active sellers</th><th class=num>GMV, last 16 weeks</th><th class=num>Growth, Q2 vs Q1</th><th class=num>Flagged at risk</th><th class=num>Went dark by " + longDate(addDays(D.meta.as_of, D.meta.horizon_days - 1)).replace(", 2018", "") + "</th></tr></thead>";
    var body = D.states.map(function (s) {
      var few = s.active_sellers < MIN_SELLERS;
      return '<tr class="' + (few ? "muted" : "") + (S.selected === s.state ? " sel" : "") + '" data-uf="' + s.state + '" tabindex="0"><td>' + esc(s.name) + (few ? " <span class=call>Too few to call</span>" : "") + "</td><td class=num>" + s.active_sellers + "</td><td class=num>" + money(s.gmv_last16w) + "</td><td class=num>" + METRICS.growth.fmt(s.gmv_growth) +
        "</td><td class=num>" + s.flagged + " (" + pct(s.flagged_share, 0) + ")</td><td class=num>" + pct(s.went_dark_share, 0) + "</td></tr>";
    }).join("");
    var t = $("state-table"); t.innerHTML = head + "<tbody>" + body + "</tbody>";
    t.querySelectorAll("tbody tr").forEach(function (tr) {
      function pick() { S.selected = tr.dataset.uf; save(); renderRegions(); var again = document.querySelector('#state-table tr[data-uf="' + S.selected + '"]'); if (again) again.focus(); }
      tr.addEventListener("click", pick);
      tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
  }
  function renderStateDetail(byState) {
    var box = $("state-detail"), uf = S.selected, s = uf && byState[uf];
    if (!uf) {
      var top = D.states.filter(function (x) { return x.active_sellers >= 30 && x.gmv_growth != null; }).sort(function (a, b) { return a.gmv_growth - b.gmv_growth; })[0];
      box.innerHTML = "<p class=name>Pick a state</p><p class=muted>Click any tile. Sao Paulo holds " + pct(byState.SP.gmv_last16w / D.risk.gmv_last16w_book, 0) + " of the book's GMV, so the other states are where territory plans differ." +
        (top ? " Among states with 30+ active sellers, " + top.name + " is shrinking fastest: GMV " + signed(top.gmv_growth, function (x) { return pct(x, 0); }) + " quarter over quarter, with " + pct(top.flagged_share, 0) + " of its sellers flagged at risk." : "") + "</p>";
      return;
    }
    if (!s) { box.innerHTML = "<p class=name>" + NAMES[uf] + "</p><p class=muted>No active sellers here as of " + longDate(D.meta.as_of) + ". Pick another state.</p>"; return; }
    box.innerHTML = "<p class=name>" + esc(s.name) + "</p><span class=muted>As of " + longDate(D.meta.as_of) + "</span><dl>" +
      "<dt>Active sellers</dt><dd>" + n0(s.active_sellers) + "</dd>" +
      "<dt>GMV, last 16 weeks</dt><dd>" + money(s.gmv_last16w) + "</dd>" +
      "<dt>GMV growth, Apr-Jun vs Jan-Mar</dt><dd>" + METRICS.growth.fmt(s.gmv_growth) + "</dd>" +
      "<dt>Flagged at risk</dt><dd>" + s.flagged + " (" + pct(s.flagged_share, 0) + ")</dd>" +
      "<dt>GMV of flagged sellers</dt><dd>" + money(s.gmv_flagged) + "</dd>" +
      "<dt>Actually went dark by " + longDate(addDays(D.meta.as_of, D.meta.horizon_days - 1)) + "</dt><dd>" + pct(s.went_dark_share, 0) + "</dd></dl>" +
      (s.active_sellers < MIN_SELLERS ? "<p class=muted>Fewer than " + MIN_SELLERS + " sellers: treat these rates as anecdotes.</p>" : "") +
      (s.flagged ? '<button type="button" class="btn" id="go-risk">See ' + s.flagged + " at-risk sellers in " + esc(s.name) + "</button>" : "<p class=muted>No sellers flagged here.</p>");
    var go = $("go-risk");
    if (go) go.addEventListener("click", function () { S.stateFilter = uf; S.shown = RISK_PAGE; save(); $("state-filter").value = uf; renderRiskControls(); renderRisk(); selectTab("risk"); });
  }

  // ---------- at-risk sellers ----------
  function renderRiskControls() {
    var sel = $("state-filter");
    var counts = {}; D.at_risk.forEach(function (r) { counts[r.state] = (counts[r.state] || 0) + 1; });
    sel.innerHTML = '<option value="all">All states (' + D.at_risk.length + ")</option>" + Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).map(function (uf) {
      return '<option value="' + uf + '">' + esc(NAMES[uf] || uf) + " (" + counts[uf] + ")</option>";
    }).join("");
    if (!(S.stateFilter in counts)) S.stateFilter = "all";
    sel.value = S.stateFilter;
    $("reveal").checked = S.reveal;
  }
  function bindRiskControls() {
    $("state-filter").addEventListener("change", function (e) { S.stateFilter = e.target.value; S.shown = RISK_PAGE; save(); renderRisk(); });
    $("reveal").addEventListener("change", function (e) { S.reveal = e.target.checked; save(); renderRisk(); });
    $("more-rows").addEventListener("click", function () { S.shown += RISK_PAGE; save(); renderRisk(); });
  }
  function renderRisk() {
    var r = D.risk, end = longDate(addDays(D.meta.as_of, D.meta.horizon_days - 1));
    document.querySelectorAll(".horizon-end").forEach(function (e) { e.textContent = end; });
    $("risk-lede").textContent = "On " + longDate(D.meta.as_of) + " the model ranked all " + n0(r.test_sellers) + " active sellers by their chance of no sale in the next " + D.meta.horizon_days +
      " days. These are the top " + pct(r.flagged / r.test_sellers, 0) + ", worst first. Click a column to sort, or turn on the switch to check them against what happened.";
    var rows = D.at_risk.filter(function (x) { return S.stateFilter === "all" || x.state === S.stateFilter; });
    var k = S.sort.key, dir = S.sort.dir;
    rows.sort(function (a, b) { return (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir; });
    var dark = rows.filter(function (x) { return x.went_dark; }).length;
    var gmv = rows.reduce(function (a, x) { return a + x.gmv_last16w; }, 0);
    var place = S.stateFilter === "all" ? "" : " in " + (NAMES[S.stateFilter] || S.stateFilter);
    $("risk-score").innerHTML = S.reveal
      ? '<div class="score hit"><b>' + pct(rows.length ? dark / rows.length : 0, 0) + "</b><span>of flagged sellers" + place + " made no sale by " + end + "</span></div>" +
        '<div class="score"><b>' + pct(r.rate_not_flagged, 0) + "</b><span>of sellers the model did not flag went dark (all states)</span></div>" +
        '<div class="score"><b>' + r.lift.toFixed(1) + "x</b><span>hit rate of the flagged list vs the whole active book</span></div>"
      : '<div class="score hit"><b>' + n0(rows.length) + "</b><span>sellers flagged" + place + "</span></div>" +
        '<div class="score"><b>' + money(gmv) + "</b><span>they sold in the 16 weeks before " + longDate(D.meta.as_of) + "</span></div>" +
        '<div class="score"><b>' + n0(r.test_sellers) + "</b><span>active sellers the model ranked</span></div>";
    var cols = [["id", "Seller"], ["state", "State"], ["category", "Main category"], ["gmv_last16w", "GMV, last 16 weeks", 1], ["days_since", "Days since last sale", 1], ["risk", "Risk", 1], ["reason", "Main reason"]];
    if (S.reveal) cols.push(["went_dark", "By " + end]);
    var head = "<thead><tr>" + cols.map(function (c) {
      var sorted = k === c[0];
      return "<th" + (c[2] ? " class=num" : "") + (sorted ? ' aria-sort="' + (dir > 0 ? "ascending" : "descending") + '"' : "") + '><button type="button" data-k="' + c[0] + '">' + c[1] + "</button></th>";
    }).join("") + "</tr></thead>";
    var body = rows.slice(0, S.shown).map(function (x) {
      return "<tr><td>" + x.id + "</td><td>" + x.state + "</td><td>" + esc(x.category) + "</td><td class=num>" + money(x.gmv_last16w) + "</td><td class=num>" + x.days_since + "</td>" +
        '<td class=num><span class="riskbar" aria-hidden="true"><i style="width:' + (x.risk * 100) + '%"></i></span>' + pct(x.risk, 0) + "</td><td>" + esc(x.reason) + "</td>" +
        (S.reveal ? "<td>" + (x.went_dark ? '<span class="outcome dark">No sale</span>' : '<span class="outcome kept">Sold ' + money(x.gmv_next) + "</span>") + "</td>" : "") + "</tr>";
    }).join("");
    $("risk-table").innerHTML = head + "<tbody>" + body + "</tbody>";
    $("risk-table").hidden = rows.length === 0;
    var empty = $("risk-empty");
    empty.hidden = rows.length > 0;
    if (!rows.length) { empty.innerHTML = "No sellers were flagged" + place + '. <button type="button" class="link-btn" id="clear-filter">Show all states</button>'; $("clear-filter").addEventListener("click", function () { S.stateFilter = "all"; save(); $("state-filter").value = "all"; renderRisk(); }); }
    $("more-rows").hidden = rows.length <= S.shown;
    $("more-rows").textContent = "Show " + Math.min(RISK_PAGE, rows.length - S.shown) + " more of " + rows.length;
    $("risk-table").querySelectorAll("th button").forEach(function (b) {
      b.addEventListener("click", function () {
        var key = b.dataset.k; S.sort = { key: key, dir: S.sort.key === key ? -S.sort.dir : (["id", "state", "category", "reason"].indexOf(key) >= 0 ? 1 : -1) }; save(); renderRisk();
        var again = document.querySelector('#risk-table th button[data-k="' + key + '"]'); if (again) again.focus();
      });
    });
  }

  // ---------- method ----------
  function renderMethod() {
    var m = D.meta, r = D.risk, a = D.activation_model;
    $("method").innerHTML =
      "<dt>The data</dt><dd><p>Olist is a Brazilian marketplace that signs small merchants through a sales team. Its public Kaggle release includes " + n0(8000) + " marketing-qualified leads, 842 closed deals with anonymized sales-rep IDs, and 99,441 marketplace orders. Nothing here is simulated.</p></dd>" +
      "<dt>The cohort</dt><dd><p>Leads first contacted " + longDate(m.cohort[0]) + " to " + longDate(m.cohort[1]) + ". A deal counts as won if it closed by " + longDate(m.win_cutoff) + ", so every signed seller has a full " + m.activation_days + "-day window before the order data ends on " + longDate(m.data_end) + ". Earlier leads are left out because the deals file starts in December 2017.</p></dd>" +
      "<dt>Definitions</dt><dd><ul><li><b>Win rate</b>: signed sellers / leads.</li><li><b>Activation rate</b>: signed sellers with a first sale within " + m.activation_days + " days of signing / signed sellers.</li><li><b>GMV</b>: item price of orders that were not canceled or unavailable, excluding freight.</li><li><b>Active seller</b>: sold in the 30 days before the snapshot and has 3+ orders in the 16 weeks before it.</li><li><b>Went dark</b>: no order in the " + m.horizon_days + " days after the snapshot.</li></ul></dd>" +
      "<dt>Above or below the team</dt><dd><p>Rates carry 90% Wilson intervals. A group is called above or below the team only when its whole interval clears the team rate and it has 15+ deals. That is why no rep is called out: the spread looks big, but the samples are small.</p></dd>" +
      "<dt>At-risk model</dt><dd><table class=data><tbody>" +
      "<tr><td>Trained on</td><td class=num>" + n0(r.train_sellers) + " sellers, Mar 31</td></tr><tr><td>Tested on</td><td class=num>" + n0(r.test_sellers) + " sellers, Jun 30</td></tr>" +
      "<tr><td>ROC AUC</td><td class=num>" + r.auc.toFixed(2) + "</td></tr><tr><td>Flagged list hit rate</td><td class=num>" + pct(r.precision_flagged, 0) + "</td></tr>" +
      "<tr><td>Base rate</td><td class=num>" + pct(r.base_rate, 0) + "</td></tr><tr><td>Spreadsheet rule hit rate</td><td class=num>" + pct(r.rule_precision, 0) + " on " + r.rule_flagged + " sellers</td></tr></tbody></table>" +
      "<p>A logistic regression on five activity signals (order trend, days since last sale, weeks active, tenure, lifetime orders). Each flag shows the signal that pushed the score up most.</p></dd>" +
      "<dt>Activation at signing</dt><dd><p>Only modestly. A model on what sales knew at signing scored ROC AUC " + a.auc.toFixed(2) + " on later deals: the lowest-scored third activated " + pct(a.activation_lowest_third, 0) + " of the time, the highest third " + pct(a.activation_highest_third, 0) + ". Good enough to order onboarding calls, not to decide who gets signed.</p></dd>" +
      "<dt>Limits</dt><dd><ul><li>Sales effort, onboarding contacts and marketing spend are not in the data, so scenarios show what a rate change is worth, not what it costs.</li><li>Seller states are only known for sellers that sold, so regions describe the active book, not new-seller funnels.</li><li>2018 Brazil, one marketplace: the method transfers; the rates don't.</li></ul></dd>";
  }

  // ---------- boot ----------
  function renderAll() {
    $("lead-count").textContent = n0(D.summary.leads);
    $("meta-window").textContent = " \u00b7 leads Jan to Apr 2018 \u00b7 seller book as of " + longDate(D.meta.as_of);
    document.querySelectorAll(".asof").forEach(function (e) { e.textContent = longDate(D.meta.as_of); });
    var h = location.hash.replace("#", "");
    if (pages().some(function (t) { return t[0] === h; })) S.tab = h;
    renderMenu(); renderEquation(); renderLeak(); renderTabs(); renderFindings(); renderChannels(); renderSellers(); renderReps();
    renderRegions(); renderRiskControls(); renderRisk(); renderMethod();
  }

  function boot() {
    tip = $("tip"); bindTips(document.body);
    $("loading").hidden = false; $("error").hidden = true; $("app").hidden = true;
    fetch("data.json", { cache: "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("data.json returned HTTP " + res.status + ".");
      return res.json();
    }).then(function (data) {
      D = data;
      BASE = { leads: D.tree.leads, win_rate: D.tree.win_rate, activation_rate: D.tree.activation_rate, gmv_per_active: D.tree.gmv_per_active };
      S = load();
      $("loading").hidden = true; $("app").hidden = false;
      try { renderAll(); } catch (e) {
        // Usually an old cached copy of the page mixed with new files: clear saved state and try once more.
        try { localStorage.removeItem(STORE); } catch (x) { /* ignore */ }
        S = defaults(); renderAll();
      }
    }).catch(function (err) {
      $("loading").hidden = true; $("error").hidden = false;
      $("error-msg").textContent = navigator.onLine
        ? "Something went wrong loading the review (" + err.message + "). Press Ctrl + F5 to reload the latest version."
        : "You're offline, so the review data could not be downloaded. Check your connection, then try again.";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("retry").addEventListener("click", boot);
    bindRiskControls();
    $("scenario").addEventListener("change", function (e) { if (e.target.value !== "custom") applyScenario(e.target.value); });
    if ($("target-input")) $("target-input").addEventListener("input", function (e) { S.target = parseFloat(e.target.value); save(); renderTarget(); });
    function net() { $("offline").hidden = navigator.onLine; }
    window.addEventListener("online", net); window.addEventListener("offline", net); net();
    boot();
  });
})();
