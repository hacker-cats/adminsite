/*
 * POSTER TEMPLATES
 *
 * Each template is one object in the list below:
 *   id          unique short name (used in CSS: .poster--<id>)
 *   name        shown in the template picker
 *   colors      default { bg, accent, text } — HEX ONLY (#rrggbb).
 *               The PNG/PDF exporter (html2canvas) can't read newer CSS
 *               color formats like oklch(), so posters stick to hex.
 *   render(d)   returns the poster's HTML. `d` contains:
 *                 d.ev        the event record (title, date, startTime, …)
 *                 d.club      club name
 *                 d.tagline   optional footer line
 *                 d.logo      image URL (uploaded logo or the default cat)
 *                 d.food      food line text, or "" if hidden
 *                 d.contact   contact line text, or "" if hidden
 *                 d.fmt       formatting helpers (see poster.js)
 *
 * To add a template: copy one of these objects, change the id/name, edit the
 * markup, and add matching styles in css/posters.css. Posters are exactly
 * 816 × 1056 px = US Letter at 96 px/inch.
 */
(function () {
  "use strict";
  const esc = window.App.esc;

  // Pick a font size that keeps long titles on the poster.
  const fit = (text, sizes) => {
    const n = String(text).length;
    for (const [max, px] of sizes) if (n <= max) return px;
    return sizes[sizes.length - 1][1];
  };
  // A row of ░ "light shade" texture characters (brand texture).
  const rail = (n = 40) => "░".repeat(n);

  window.POSTER_TEMPLATES = [
    {
      id: "terminal",
      name: "Terminal",
      colors: { bg: "#2F2114", accent: "#E4B33A", text: "#F2EFE6" },
      render: (d) => `
        <div class="poster__top">
          <img class="poster__logo" src="${esc(d.logo)}" alt="">
          <div>
            <div class="poster__club">${esc(d.club)}</div>
            <div class="poster__uni">${esc(CONFIG.club.university)}</div>
          </div>
        </div>
        <div class="pt-prompt">&gt;_ ./${esc(App.slugify(d.ev.title))}</div>
        <h1 class="poster__title" style="font-size:${fit(d.ev.title, [[10, 112], [18, 88], [30, 68], [50, 52], [999, 40]])}px">${esc(d.ev.title)}</h1>
        ${d.ev.description ? `<p class="poster__desc">${esc(d.ev.description)}</p>` : ""}
        <div class="pt-lines">
          <div><span class="k">$ when</span><span>${esc(d.fmt.date(d.ev.date))}<br>${esc(d.fmt.time(d.ev))}</span></div>
          <div><span class="k">$ where</span><span>${esc(d.fmt.where(d.ev))}</span></div>
          ${d.food ? `<div><span class="k">$ food</span><span>${esc(d.food)}</span></div>` : ""}
        </div>
        <div class="poster__spacer"></div>
        <div class="poster__rail">${rail(48)}</div>
        <div class="poster__foot">
          <span>${esc(d.tagline)}</span><span>${esc(d.contact)}</span>
        </div>`,
    },

    {
      id: "notice",
      name: "Field notice",
      colors: { bg: "#C2A97F", accent: "#E4B33A", text: "#2F2114" },
      render: (d) => `
        <div class="poster__rail pn-rail">${rail(48)}</div>
        <div class="pn-body">
          <div class="pn-eyebrow">Field notice · ${esc(d.club)}</div>
          <h1 class="poster__title" style="font-size:${fit(d.ev.title, [[10, 104], [18, 84], [30, 64], [50, 50], [999, 38]])}px">${esc(d.ev.title)}</h1>
          ${d.ev.description ? `<p class="poster__desc">${esc(d.ev.description)}</p>` : ""}
          <div class="pn-grid">
            <div class="pn-cell">
              <span class="pn-lbl">When</span>
              <span class="pn-big">${esc(d.fmt.monthDay(d.ev.date))}</span>
              <span>${esc(d.fmt.weekday(d.ev.date))} · ${esc(d.fmt.time(d.ev))}</span>
            </div>
            <div class="pn-cell">
              <span class="pn-lbl">Where</span>
              <span class="pn-mid">${esc(d.ev.building)}</span>
              <span>${d.ev.room ? "Room " + esc(d.ev.room) : ""}</span>
            </div>
          </div>
          ${d.food ? `<div class="pn-food">${esc(d.food)}</div>` : ""}
        </div>
        <div class="poster__spacer"></div>
        <div class="pn-foot">
          <img class="poster__logo" src="${esc(d.logo)}" alt="">
          <div>
            <div class="poster__club">${esc(d.club)}</div>
            <div>${esc(d.tagline)}</div>
            <div>${esc(d.contact)}</div>
          </div>
        </div>
        <div class="poster__rail pn-rail">${rail(48)}</div>`,
    },

    {
      id: "bigdate",
      name: "Big date",
      colors: { bg: "#E4B33A", accent: "#2F2114", text: "#2F2114" },
      render: (d) => `
        <div class="pb-main">
          <div class="pb-date">
            <span class="pb-month">${esc(d.fmt.month(d.ev.date))}</span>
            <span class="pb-day">${esc(d.fmt.day(d.ev.date))}</span>
            <span class="pb-dow">${esc(d.fmt.weekday(d.ev.date))}</span>
          </div>
          <div class="pb-text">
            <div class="poster__club">${esc(d.club)} presents</div>
            <h1 class="poster__title" style="font-size:${fit(d.ev.title, [[8, 96], [16, 74], [28, 58], [50, 44], [999, 34]])}px">${esc(d.ev.title)}</h1>
            ${d.ev.description ? `<p class="poster__desc">${esc(d.ev.description)}</p>` : ""}
          </div>
        </div>
        <div class="poster__spacer"></div>
        <div class="pb-band">
          <div><span class="pb-lbl">Time</span>${esc(d.fmt.time(d.ev))}</div>
          <div><span class="pb-lbl">Place</span>${esc(d.fmt.where(d.ev))}</div>
          ${d.food ? `<div><span class="pb-lbl">Food</span>${esc(d.food)}</div>` : ""}
        </div>
        <div class="pb-foot">
          <img class="poster__logo" src="${esc(d.logo)}" alt="">
          <span>${esc(d.tagline)}</span>
          <span>${esc(d.contact)}</span>
        </div>`,
    },
  ];
})();
