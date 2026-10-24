/*
 * Poster generator. Renders a template from js/poster-templates.js with the
 * chosen event, then exports it with html2canvas (PNG) and jsPDF (PDF).
 * Your choices (template, colors, logo, …) are remembered in this browser.
 */
(function () {
  "use strict";
  const { $, $$, esc, icon, param, today, fmtDate, fmtTimeRange, toast, eventOptions, parseDate } = window.App;
  const content = $("#content");
  const exportEl = $("#poster-export");
  const TEMPLATES = window.POSTER_TEMPLATES;
  const SETTINGS_KEY = "hc-admin-poster-settings";
  const DEFAULT_LOGO = "assets/icons/cat.svg";

  let events = [];
  let ev = null;
  let s = loadSettings();

  function loadSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch (e) {}
    const tpl = TEMPLATES.find((t) => t.id === saved.template) || TEMPLATES[0];
    return {
      template: tpl.id,
      club: CONFIG.club.name,
      tagline: "Free & open to all students",
      showFood: true,
      showContact: true,
      logo: "",
      colors: { ...tpl.colors },
      ...saved,
    };
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
    catch (e) { toast("Couldn't remember settings (logo may be too large)", "danger"); }
  }

  // Formatting helpers passed to templates as d.fmt
  const fmt = {
    date: (iso) => fmtDate(iso),
    time: (e) => fmtTimeRange(e.startTime, e.endTime),
    where: (e) => [e.building, e.room && "Room " + e.room].filter(Boolean).join(" · "),
    month: (iso) => parseDate(iso).toLocaleDateString("en-US", { month: "short" }),
    day: (iso) => String(parseDate(iso).getDate()),
    weekday: (iso) => parseDate(iso).toLocaleDateString("en-US", { weekday: "long" }),
    monthDay: (iso) => parseDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase(),
  };

  function posterHtml() {
    const tpl = TEMPLATES.find((t) => t.id === s.template) || TEMPLATES[0];
    const d = {
      ev, fmt,
      club: s.club,
      tagline: s.tagline,
      logo: s.logo || DEFAULT_LOGO,
      food: s.showFood && ev.hasFood ? "Food provided" + (ev.vendor ? " · " + ev.vendor : "") : "",
      contact: s.showContact ? [ev.organizerName, ev.organizerEmail].filter(Boolean).join(" · ") : "",
    };
    const style = `--bg:${s.colors.bg};--accent:${s.colors.accent};--text:${s.colors.text}`;
    return `<div class="poster poster--${tpl.id}" style="${style}">${tpl.render(d)}</div>`;
  }

  function renderPoster() {
    const html = posterHtml();
    $("#stage-inner").innerHTML = html;
    exportEl.innerHTML = html;
    fitStage();
  }

  // Scale the 816px-wide preview to fit its column.
  function fitStage() {
    const stage = $(".poster-stage");
    if (!stage) return;
    const inner = $("#stage-inner");
    const w = stage.clientWidth - 32;
    const k = Math.min(1, w / 816);
    inner.style.transform = `scale(${k})`;
    inner.style.height = 1056 * k + "px";
    inner.style.width = 816 * k + "px";
  }

  /* ---------- export ---------- */
  async function capture() {
    if (!window.html2canvas) throw new Error("Export library didn't load (check your connection).");
    await document.fonts.ready;
    // Make sure the poster fonts are loaded; if one fails, export anyway with a fallback font.
    await Promise.all(["700 40px 'IBM Plex Mono'", "400 20px 'IBM Plex Mono'", "400 20px 'IBM Plex Sans'", "700 40px 'IBM Plex Sans'"]
      .map((f) => document.fonts.load(f).catch(() => console.warn("Font failed to load:", f))));
    // scale 3 => 2448 × 3168 px, i.e. 288 dpi on a letter page.
    return html2canvas(exportEl.firstElementChild, {
      scale: 3, backgroundColor: null, useCORS: true, logging: false,
      // html2canvas reads the page background too, and can't parse the
      // design kit's oklch() colors, so give its copy of the page plain hex.
      onclone: (doc) => { doc.documentElement.style.background = doc.body.style.background = "#ffffff"; },
    });
  }
  const fileBase = () => (ev ? ev.id : "poster") + "-poster";

  async function downloadPng(btn) {
    btn.disabled = true;
    try {
      const canvas = await capture();
      canvas.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileBase() + ".png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, "image/png");
    } catch (e) { toast(e.message, "danger"); }
    btn.disabled = false;
  }

  async function downloadPdf(btn) {
    btn.disabled = true;
    try {
      const canvas = await capture();
      const pdf = new window.jspdf.jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
      // "FAST" = compress the image (otherwise the PDF is ~30 MB).
      pdf.addImage(canvas, "PNG", 0, 0, 8.5, 11, undefined, "FAST");
      pdf.save(fileBase() + ".pdf");
    } catch (e) { toast(e.message, "danger"); }
    btn.disabled = false;
  }

  /* ---------- logo upload (downscaled so it fits in localStorage) ---------- */
  function readLogo(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 600;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("That file doesn't look like an image."));
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- controls ---------- */
  function renderControls() {
    content.innerHTML = `
      <div class="poster-layout">
        <div class="stack">
          <label class="field"><span>Event</span><select id="ev">${eventOptions(events, ev.id)}</select></label>
          <div class="field"><span>Template</span>
            <div class="tpl-pick">${TEMPLATES.map((t) => `<label><input type="radio" name="tpl" value="${t.id}"${t.id === s.template ? " checked" : ""}> ${esc(t.name)}</label>`).join("")}</div>
          </div>
          <label class="field"><span>Club name</span><input id="club" value="${esc(s.club)}"></label>
          <label class="field"><span>Footer tagline</span><input id="tagline" value="${esc(s.tagline)}"></label>
          <div class="field"><span>Colors</span>
            <div class="row">
              <label class="check"><input type="color" id="c-bg" value="${s.colors.bg}"> background</label>
              <label class="check"><input type="color" id="c-accent" value="${s.colors.accent}"> accent</label>
              <label class="check"><input type="color" id="c-text" value="${s.colors.text}"> text</label>
              <button class="btn btn--sm btn--plain" id="reset-colors" type="button">reset</button>
            </div>
          </div>
          <div class="field"><span>Logo</span>
            <div class="row">
              <input type="file" id="logo" accept="image/*">
              <button class="btn btn--sm btn--plain" id="clear-logo" type="button">use default</button>
            </div>
          </div>
          <div class="row">
            <label class="check"><input type="checkbox" id="show-food"${s.showFood ? " checked" : ""}> Show food line</label>
            <label class="check"><input type="checkbox" id="show-contact"${s.showContact ? " checked" : ""}> Show organizer contact</label>
          </div>
          <div class="row">
            <button class="btn" id="png">${icon("download")} PNG</button>
            <button class="btn" id="pdf">${icon("file")} PDF (letter)</button>
            <button class="btn btn--plain" id="print">${icon("print")} Print</button>
          </div>
          <div class="row" id="made-row"></div>
        </div>
        <div class="poster-stage"><div id="stage-inner" class="poster-stage__inner"></div></div>
      </div>`;

    const rerender = () => { saveSettings(); renderPoster(); };
    $("#ev").onchange = (e) => { ev = events.find((x) => x.id === e.target.value); history.replaceState(null, "", "?id=" + encodeURIComponent(ev.id)); renderMadeRow(); renderPoster(); };
    $$("input[name=tpl]").forEach((r) => (r.onchange = () => {
      s.template = r.value;
      s.colors = { ...TEMPLATES.find((t) => t.id === r.value).colors };
      ["bg", "accent", "text"].forEach((k) => ($("#c-" + k).value = s.colors[k]));
      rerender();
    }));
    $("#club").oninput = (e) => { s.club = e.target.value; rerender(); };
    $("#tagline").oninput = (e) => { s.tagline = e.target.value; rerender(); };
    ["bg", "accent", "text"].forEach((k) => ($("#c-" + k).oninput = (e) => { s.colors[k] = e.target.value; rerender(); }));
    $("#reset-colors").onclick = () => {
      s.colors = { ...TEMPLATES.find((t) => t.id === s.template).colors };
      ["bg", "accent", "text"].forEach((k) => ($("#c-" + k).value = s.colors[k]));
      rerender();
    };
    $("#logo").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { s.logo = await readLogo(f); rerender(); } catch (err) { toast(err.message, "danger"); }
    };
    $("#clear-logo").onclick = () => { s.logo = ""; $("#logo").value = ""; rerender(); };
    $("#show-food").onchange = (e) => { s.showFood = e.target.checked; rerender(); };
    $("#show-contact").onchange = (e) => { s.showContact = e.target.checked; rerender(); };
    $("#png").onclick = (e) => downloadPng(e.currentTarget);
    $("#pdf").onclick = (e) => downloadPdf(e.currentTarget);
    $("#print").onclick = () => window.print();
    renderMadeRow();
    renderPoster();
  }

  function renderMadeRow() {
    $("#made-row").innerHTML = ev.posterMade
      ? `<span class="chip chip--live">poster marked as made</span>`
      : `<button class="btn btn--sm btn--ink" id="mark-made">${icon("check")} Mark “poster made”</button>`;
    const b = $("#mark-made");
    if (b) b.onclick = async () => {
      try {
        ev = await Store.patch("events", ev.id, { posterMade: true });
        events = events.map((x) => (x.id === ev.id ? ev : x));
        renderMadeRow();
        toast("Status updated");
      } catch (e) { toast(e.message, "danger"); }
    };
  }

  window.addEventListener("resize", fitStage);

  App.withData(content, async () => {
    events = await Store.list("events");
    if (!events.length) {
      content.innerHTML = `<div class="empty">No events yet. <a href="event.html">Create one</a> first.</div>`;
      return;
    }
    const t = today();
    ev = events.find((e) => e.id === param("id")) ||
      events.filter((e) => e.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0] || events[0];
    renderControls();
  });
})();
