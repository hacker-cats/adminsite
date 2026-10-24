/*
 * Calendar page: month grid (events + recurring meetings + breaks), an
 * optional embedded Google Calendar, and "add to calendar" downloads.
 */
(function () {
  "use strict";
  const { $, $$, esc, icon, today, isoDate, addDays, fmtDate, fmtTimeRange, location: loc, DOW, download } = window.App;
  const content = $("#content");
  const embedId = CONFIG.google.calendarEmbedId;

  let events = [], meetings = [];
  const now = new Date();
  let view = { y: now.getFullYear(), m: now.getMonth() };

  function drawMonth() {
    const first = isoDate(new Date(view.y, view.m, 1));
    // include the visible days of the previous/next month
    const items = Cal.calendarItems(events, meetings, addDays(first, -7), addDays(first, 42));
    Cal.renderMonth($("#month"), view.y, view.m, items, (delta) => {
      if (delta === 0) view = { y: now.getFullYear(), m: now.getMonth() };
      else { const d = new Date(view.y, view.m + delta, 1); view = { y: d.getFullYear(), m: d.getMonth() }; }
      drawMonth();
    });
  }

  function meetingRow(m) {
    const g = Cal.meetingGoogleLink(m);
    return `<tr>
      <td><strong>${esc(m.title)}</strong><br><span class="muted">${esc(loc(m))}</span></td>
      <td>${m.frequency === "biweekly" ? "Every other" : "Every"} ${esc(DOW[m.weekday])}<br>${esc(fmtTimeRange(m.startTime, m.endTime))}</td>
      <td class="mono">${esc(fmtDate(m.firstDate, "numeric"))} – ${esc(fmtDate(m.lastDate, "numeric"))}</td>
      <td><div class="row">
        <button class="btn btn--sm btn--plain" data-mics="${esc(m.id)}">${icon("calendar")} .ics</button>
        ${g ? `<a class="btn btn--sm btn--plain" target="_blank" rel="noopener" href="${esc(g)}" title="Google's link can't skip break days; use the .ics for exact dates">Google Cal</a>` : ""}
      </div></td>
    </tr>`;
  }

  function render() {
    const t = today();
    const upcoming = events.filter((e) => e.date >= t);
    content.innerHTML = `
      ${embedId ? `<div class="tabs" role="tablist">
        <button role="tab" aria-selected="true" data-tab="month">Month</button>
        <button role="tab" aria-selected="false" data-tab="google">Google Calendar</button>
      </div>` : ""}
      <div id="tab-month" class="stack">
        <div id="month"></div>
        <div class="legend">
          <span class="cal__item cal__item--event">event</span>
          <span class="cal__item cal__item--meeting">meeting</span>
          <span class="cal__item cal__item--break">break / no class</span>
          <a href="plan.html">Edit meetings &amp; semester dates →</a>
        </div>
      </div>
      ${embedId ? `<div id="tab-google" class="hidden">
        <iframe title="Club Google Calendar" style="width:100%;height:min(72vh,620px);border:2px solid var(--border-strong);background:var(--surface-page)"
          src="https://calendar.google.com/calendar/embed?mode=MONTH&showTitle=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&bgcolor=%23C2A97F&ctz=${encodeURIComponent(CONFIG.club.timeZone)}&src=${encodeURIComponent(embedId)}"></iframe>
      </div>` : ""}

      <section class="card">
        <div class="card__bar"><span>Add to your calendar</span>${icon("calendar")}</div>
        <div class="card__body">
          <div class="row">
            <button class="btn" id="all-ics">${icon("download")} Everything upcoming (.ics)</button>
            <span class="muted">One file with all ${upcoming.length} upcoming events and ${meetings.length} recurring meeting series. Import it into Google Calendar, Outlook, or Apple Calendar.</span>
          </div>
          ${meetings.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Meeting</th><th>When</th><th>Dates</th><th></th></tr></thead>
            <tbody>${meetings.map(meetingRow).join("")}</tbody></table></div>`
            : `<div class="empty">No recurring meetings yet. <a href="plan.html#meetings">Add one</a>.</div>`}
        </div>
      </section>`;

    drawMonth();
    $$("[data-tab]").forEach((b) => (b.onclick = () => {
      $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      $("#tab-month").classList.toggle("hidden", b.dataset.tab !== "month");
      $("#tab-google").classList.toggle("hidden", b.dataset.tab !== "google");
    }));
    $$("[data-mics]").forEach((b) => (b.onclick = () => {
      const m = meetings.find((x) => x.id === b.dataset.mics);
      download("meeting-" + m.id + ".ics", Cal.meetingIcs(m), "text/calendar");
    }));
    $("#all-ics").onclick = () =>
      download(App.slugify(CONFIG.club.name) + "-calendar.ics", Cal.combinedIcs(upcoming, meetings), "text/calendar");
  }

  App.withData(content, async () => {
    [events, meetings] = await Promise.all([Store.list("events"), Store.list("meetings")]);
    render();
  });
})();
