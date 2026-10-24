/*
 * Shared helpers used by every page: the page chrome (skip link, header,
 * footer), small UI builders (icon, alert, badge), formatting, the MSU
 * catering rule checks, and the sign-in gate.
 */
(function () {
  "use strict";
  const C = window.CONFIG;

  /* ---------- tiny DOM helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const param = (name) => new URLSearchParams(location.search).get(name);

  /* ---------- UI builders (match design-kit components) ---------- */

  // Pixel icon palettes, from design-kit/components/core/Icon.jsx.
  // ink = on light surfaces, onDark = on brown/ink/red buttons and chrome,
  // full = adds yellow/green/red status markers (alerts).
  const PALETTES = {
    full:  { "#": "var(--hc-ink-deep)", B: "oklch(0.34 0.05 58)", s: "oklch(0.55 0.07 60)", S: "oklch(0.46 0.07 60)", "=": "oklch(0.44 0.07 60)", "-": "oklch(0.34 0.05 58)", y: "var(--hc-signal)", o: "oklch(0.68 0.14 88)", g: "var(--hc-live)", r: "var(--hc-oxide)" },
    ink:   { "#": "var(--hc-ink-deep)", B: "oklch(0.44 0.05 58)", s: "oklch(0.60 0.06 60)", S: "oklch(0.56 0.06 60)", "=": "oklch(0.48 0.06 60)", "-": "oklch(0.34 0.05 58)", y: "var(--hc-ink-deep)", o: "oklch(0.52 0.06 60)", g: "var(--hc-ink-deep)", r: "var(--hc-ink-deep)" },
    onDark:{ "#": "var(--hc-signal)", B: "oklch(0.52 0.09 86)", s: "oklch(0.44 0.07 84)", S: "oklch(0.36 0.06 84)", "=": "oklch(0.60 0.10 86)", "-": "oklch(0.46 0.08 84)", y: "oklch(0.90 0.14 92)", o: "oklch(0.70 0.12 88)", g: "oklch(0.58 0.11 150)", r: "oklch(0.66 0.16 34)" },
  };

  /** Decorative pixel icon as inline SVG. Icons never replace a text label. */
  function icon(name, tone = "ink", size = 18) {
    const grid = window.ICON_GRIDS[name];
    if (!grid) return "";
    const pal = PALETTES[tone] || PALETTES.ink;
    let rects = "";
    grid.forEach((row, r) => row.split("").forEach((ch, c) => {
      if (ch !== ".") rects += `<rect x="${c * 4}" y="${r * 4}" width="4" height="4" fill="${pal[ch]}"/>`;
    }));
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
  }

  const ALERTS = {
    info:    { icon: "info", title: "Note", role: "status" },
    warning: { icon: "warning", title: "Heads up", role: "status" },
    danger:  { icon: "warning", title: "Danger", role: "alert" },
    live:    { icon: "wifi", title: "Live", role: "status" },
  };
  /** Inline message. kind: info | warning | danger | live. `body` may contain HTML. */
  function alert(kind, title, body = "") {
    const k = ALERTS[kind] || ALERTS.info;
    return `<div class="alert alert--${kind}" role="${k.role}">${icon(k.icon, "full", 20)}
      <div><p class="alert__title">${title || k.title}</p>${body ? `<p class="alert__body">${body}</p>` : ""}</div></div>`;
  }

  /** Category or status chip. tone: neutral | signal | danger | live | ink */
  const badge = (text, tone = "neutral") => `<span class="badge${tone === "neutral" ? "" : " badge--" + tone}">${esc(text)}</span>`;

  /* ---------- dates (all "YYYY-MM-DD" strings, local time) ---------- */
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const isoDate = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = () => isoDate(new Date());
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

  function fmtDate(s, style = "long") {
    if (!s) return "";
    const d = parseDate(s);
    if (style === "short") return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (style === "numeric") return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return m ? `${h12}:${String(m).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
  }
  const fmtTimeRange = (a, b) => (b ? `${fmtTime(a)}–${fmtTime(b)}` : fmtTime(a));
  const location_ = (ev) => [ev.building, ev.room].filter(Boolean).join(" ");

  function slugify(s) {
    return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48) || "event";
  }

  /* ---------- MSU catering rules (driven by CONFIG.catering) ---------- */
  const squash = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  /**
   * Work out which catering rules apply to an event.
   * Returns { outsideFood, exempt, overLimit, needsFror, buildingWarnings[] }.
   */
  function cateringRules(ev) {
    const cat = C.catering;
    const outsideFood = !!ev.hasFood && !!String(ev.vendor || "").trim();
    const exempt = outsideFood && cat.exemptVendors.some((v) => squash(ev.vendor).includes(squash(v)));
    const overLimit = outsideFood && Number(ev.attendance) >= cat.attendanceLimit;
    const buildingWarnings = cat.specialBuildings
      .filter((b) => b.match.some((m) => new RegExp("\\b" + m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(ev.building || "")))
      .map((b) => b.warning);
    return { outsideFood, exempt, overLimit, needsFror: outsideFood && !exempt, buildingWarnings };
  }

  /** Status checklist items that apply to this event. */
  function statusItems(ev) {
    const r = cateringRules(ev);
    const items = [{ key: "posterMade", label: "Poster made" }];
    if (r.needsFror) {
      items.push({ key: "frorSent", label: "Catering email sent" });
      items.push({ key: "approvalReceived", label: "Approval received" });
    }
    if (ev.hasFood) items.push({ key: "foodOrdered", label: "Food ordered" });
    return items.map((i) => ({ ...i, done: !!ev[i.key] }));
  }

  /* ---------- toast (role="status") ---------- */
  let toastTimer;
  function toast(msg, kind = "") {
    let el = $(".toast");
    if (!el) { el = document.createElement("div"); document.body.appendChild(el); }
    el.setAttribute("role", kind === "danger" ? "alert" : "status");
    el.className = "toast" + (kind ? " toast--" + kind : "");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === "danger" ? 7000 : 3000);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast("Copied to clipboard."); }
    catch (e) {
      // Fallback for browsers that block the clipboard API.
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); toast("Copied to clipboard.");
    }
  }

  function download(filename, text, type = "text/plain") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- page chrome: skip link, header, footer ---------- */
  const PAGES = [
    ["index.html", "Dashboard"],
    ["calendar.html", "Calendar"],
    ["plan.html", "Semester plan"],
    ["poster.html", "Poster"],
    ["fror.html", "Catering email"],
    ["setup.html", "Setup"],
  ];

  function renderChrome() {
    const here = location.pathname.split("/").pop() || "index.html";
    const cur = (href) => (href === here ? ' aria-current="page"' : "");
    const header = document.createElement("header");
    header.className = "site-header no-print";
    header.innerHTML = `
      <div class="wrap site-header__inner">
        <a class="brand" href="index.html" aria-label="hackercats club admin, dashboard">
          <span class="wordmark" aria-hidden="true"><span class="prompt">&gt;_</span> hackercats</span>
          <span class="brand__sub" aria-hidden="true">club admin</span>
        </a>
        <nav class="site-nav" aria-label="Main">
          <ul>${PAGES.map(([href, label]) => `<li><a href="${href}"${cur(href)}>${label}</a></li>`).join("")}</ul>
          <a class="btn btn--signal btn--sm" href="event.html"${cur("event.html")}>New event</a>
          <div class="auth" id="nav-auth"></div>
        </nav>
      </div>`;

    const skip = document.createElement("a");
    skip.className = "skip";
    skip.href = "#main";
    skip.textContent = "Skip to main content";

    document.body.prepend(skip, header);
    if (Store.mode === "demo") {
      const band = document.createElement("div");
      band.className = "notice-band no-print";
      band.innerHTML = `<div class="wrap"><strong>Demo mode.</strong> Data is saved only in this browser. <a href="setup.html">Connect Google Sheets</a> to share it with other officers.</div>`;
      header.after(band);
    }

    const footer = document.createElement("footer");
    footer.className = "site-footer no-print";
    footer.innerHTML = `
      <div class="wrap">
        <div>
          <span class="wordmark" aria-hidden="true"><span class="prompt">&gt;_</span> hackercats</span>
          <p>Club admin for ${esc(C.club.name)}, a student cybersecurity club at ${esc(C.club.university)}.</p>
        </div>
        <p><a href="https://github.com/hacker-cats/adminsite#readme">How to edit and deploy</a></p>
      </div>`;
    const main = $("main");
    (main ? main.parentNode : document.body).insertBefore(footer, main ? main.nextSibling : null);
    renderAuth();
  }

  function renderAuth() {
    const el = $("#nav-auth");
    if (!el || Store.mode === "demo") return;
    if (Store.isSignedIn()) {
      el.innerHTML = `<span>Signed in</span><button class="btn btn--on-ink btn--sm" id="sign-out">Sign out</button>`;
      $("#sign-out").onclick = () => { Store.signOut(); location.reload(); };
    } else {
      el.innerHTML = "";
    }
  }

  /**
   * Run `load` once data is reachable. In Sheets mode without a valid token
   * this shows a "Sign in with Google" panel inside `container` first
   * (browsers only allow the Google popup after a click).
   */
  function withData(container, load) {
    const run = async () => {
      try { await load(); }
      catch (e) {
        if (e instanceof Store.AuthError) return gate(e.message);
        console.error(e);
        container.innerHTML = alert("danger", "Something went wrong", esc(e.message));
      }
    };
    const gate = (msg) => {
      container.innerHTML = `
        <section class="card" style="max-width: 560px">
          <h2>Sign in to continue</h2>
          <p>${esc(msg || "Club data lives in a private Google Sheet. Sign in with a Google account the Sheet is shared with.")}</p>
          <div class="row"><button class="btn" id="gate-sign-in">Sign in with Google</button></div>
        </section>`;
      $("#gate-sign-in").onclick = async () => {
        try { await Store.signIn(); renderAuth(); run(); }
        catch (e) { toast(e.message, "danger"); }
      };
    };
    if (!Store.isSignedIn()) return gate();
    run();
  }

  /** <option>s of events, upcoming first; used by poster + email pages. */
  function eventOptions(events, selectedId) {
    const t = today();
    const upcoming = events.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date));
    const past = events.filter((e) => e.date < t).sort((a, b) => b.date.localeCompare(a.date));
    const opt = (e) => `<option value="${esc(e.id)}"${e.id === selectedId ? " selected" : ""}>${esc(fmtDate(e.date, "short"))}: ${esc(e.title)}</option>`;
    return (upcoming.length ? `<optgroup label="Upcoming">${upcoming.map(opt).join("")}</optgroup>` : "") +
      (past.length ? `<optgroup label="Past">${past.map(opt).join("")}</optgroup>` : "");
  }

  /** Field wrapper markup: label + optional hint + control + optional note. */
  function field({ id, label, hint = "", control, note = "" }) {
    return `<div class="field">
      <div class="field__top"><label for="${id}">${label}</label>${hint ? `<span class="field__hint">${hint}</span>` : ""}</div>
      ${control}
      <p class="field__note" id="${id}-note"${note ? "" : " hidden"}>${note}</p>
    </div>`;
  }

  window.App = {
    $, $$, esc, param, icon, alert, badge, field,
    DOW, parseDate, isoDate, today, addDays, daysBetween,
    fmtDate, fmtTime, fmtTimeRange, location: location_, slugify,
    cateringRules, statusItems,
    toast, copyText, download,
    withData, eventOptions,
  };

  document.addEventListener("DOMContentLoaded", renderChrome);
})();
