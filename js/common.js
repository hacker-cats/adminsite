/*
 * Shared helpers used by every page: navigation, formatting, the MSU
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
  const icon = (name, alt = "") => `<img src="assets/icons/${name}.svg" alt="${esc(alt)}" width="16" height="16">`;

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
  const fmtTimeRange = (a, b) => (b ? `${fmtTime(a)} – ${fmtTime(b)}` : fmtTime(a));
  const location_ = (ev) => [ev.building, ev.room].filter(Boolean).join(", ");

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
      items.push({ key: "frorSent", label: "FRoR email sent" });
      items.push({ key: "approvalReceived", label: "Approval received" });
    }
    if (ev.hasFood) items.push({ key: "foodOrdered", label: "Food ordered" });
    return items.map((i) => ({ ...i, done: !!ev[i.key] }));
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg, kind = "") {
    let el = $(".toast");
    if (!el) { el = document.createElement("div"); el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.className = "toast" + (kind ? " toast--" + kind : "");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === "danger" ? 7000 : 3000);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
    catch (e) {
      // Fallback for browsers that block the clipboard API.
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); toast("Copied to clipboard");
    }
  }

  function download(filename, text, type = "text/plain") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- navigation ---------- */
  const PAGES = [
    ["index.html", "dashboard"],
    ["calendar.html", "calendar"],
    ["plan.html", "semester plan"],
    ["event.html", "+ new event"],
    ["poster.html", "poster"],
    ["fror.html", "catering email"],
    ["setup.html", "setup"],
  ];

  function renderNav() {
    const here = location.pathname.split("/").pop() || "index.html";
    const nav = document.createElement("nav");
    nav.className = "nav no-print";
    nav.innerHTML = `
      <div class="nav__inner">
        <a class="nav__brand" href="index.html"><img src="assets/icons/cat.svg" alt="">&gt;_ ${esc(C.club.name.toLowerCase().replace(/\s+/g, ""))}</a>
        <div class="nav__links">
          ${PAGES.map(([href, label]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
        </div>
        <div class="nav__auth" id="nav-auth"></div>
      </div>`;
    document.body.prepend(nav);
    if (Store.mode === "demo") {
      const b = document.createElement("div");
      b.className = "banner no-print";
      b.innerHTML = `DEMO MODE — data is saved only in this browser. See <a href="setup.html">setup</a> to connect Google Sheets.`;
      nav.after(b);
    }
    renderAuth();
  }

  function renderAuth() {
    const el = $("#nav-auth");
    if (!el || Store.mode === "demo") return;
    if (Store.isSignedIn()) {
      el.innerHTML = `<span class="chip chip--live">signed in</span><button class="btn btn--sm btn--plain" id="sign-out">sign out</button>`;
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
        container.innerHTML = `<div class="alert alert--danger">${icon("warning")}<div><strong>Something went wrong.</strong><br>${esc(e.message)}</div></div>`;
      }
    };
    const gate = (msg) => {
      container.innerHTML = `
        <div class="card"><div class="card__body">
          <h2>Sign in to continue</h2>
          <p class="muted">${esc(msg || "Club data is stored in a private Google Sheet. Sign in with a Google account the Sheet is shared with.")}</p>
          <div class="row"><button class="btn" id="gate-sign-in">${icon("key")} Sign in with Google</button></div>
        </div></div>`;
      $("#gate-sign-in").onclick = async () => {
        try { await Store.signIn(); renderAuth(); run(); }
        catch (e) { toast(e.message, "danger"); }
      };
    };
    if (!Store.isSignedIn()) return gate();
    run();
  }

  /** <select> of events, newest-upcoming first; used by poster + email pages. */
  function eventOptions(events, selectedId) {
    const t = today();
    const upcoming = events.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date));
    const past = events.filter((e) => e.date < t).sort((a, b) => b.date.localeCompare(a.date));
    const opt = (e) => `<option value="${esc(e.id)}"${e.id === selectedId ? " selected" : ""}>${esc(fmtDate(e.date, "short"))} — ${esc(e.title)}</option>`;
    return (upcoming.length ? `<optgroup label="Upcoming">${upcoming.map(opt).join("")}</optgroup>` : "") +
      (past.length ? `<optgroup label="Past">${past.map(opt).join("")}</optgroup>` : "");
  }

  window.App = {
    $, $$, esc, param, icon,
    DOW, parseDate, isoDate, today, addDays, daysBetween,
    fmtDate, fmtTime, fmtTimeRange, location: location_, slugify,
    cateringRules, statusItems,
    toast, copyText, download,
    withData, renderNav, eventOptions,
  };

  document.addEventListener("DOMContentLoaded", renderNav);
})();
