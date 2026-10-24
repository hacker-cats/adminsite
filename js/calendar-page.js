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
      <td><strong style="color: var(--web-ink)">${esc(m.title)}</strong><br><span class="muted">${esc(loc(m))}</span></td>
      <td>${m.frequency === "biweekly" ? "Every other" : "Every"} ${esc(DOW[m.weekday])}<br>${esc(fmtTimeRange(m.startTime, m.endTime))}</td>
      <td>${esc(fmtDate(m.firstDate, "numeric"))} to ${esc(fmtDate(m.lastDate, "numeric"))}</td>
      <td><div class="row" style="gap: 8px">
        <button class="btn btn--secondary btn--sm" data-mics="${esc(m.id)}">Download .ics</button>
        ${g ? `<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="${esc(g)}">Google Calendar<span class="sr-only"> (opens in a new tab)</span></a>` : ""}
      </div></td>
    </tr>`;
  }

  function render() {
    const t = today();
    const upcoming = events.filter((e) => e.date >= t);
    content.innerHTML = `
      ${embedId ? `<div class="segmented" role="group" aria-label="Calendar view">
        <button type="button" aria-pressed="true" data-view="month">Month</button>
        <button type="button" aria-pressed="false" data-view="google">Club Google Calendar</button>
      </div>` : ""}
      <div id="view-month" class="stack">
        <div id="month"></div>
        <div class="legend">
          <span class="cal__item cal__item--event">Event</span>
          <span class="cal__item cal__item--meeting">Meeting</span>
          <span class="cal__item cal__item--break">Break, no meetings</span>
          <a href="plan.html">Edit meetings and semester dates</a>
        </div>
      </div>
      ${embedId ? `<div id="view-google" class="hidden">
        <iframe title="Club Google Calendar" style="width:100%;height:min(72vh,620px);border:1px solid var(--web-line);border-radius:var(--web-radius);background:var(--web-surface)"
          src="https://calendar.google.com/calendar/embed?mode=MONTH&showTitle=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&bgcolor=%23FFFCF6&ctz=${encodeURIComponent(CONFIG.club.timeZone)}&src=${encodeURIComponent(embedId)}"></iframe>
      </div>` : ""}

      <section class="stack" aria-labelledby="add-h">
        <div class="section-head">
          <div>
            <h2 id="add-h">Add to your calendar</h2>
            <p>One file with all ${upcoming.length} upcoming events and ${meetings.length} recurring meetings. Import it into Google Calendar, Outlook or Apple Calendar.</p>
          </div>
          <button class="btn" id="all-ics">${icon("download", "onDark")} Download everything (.ics)</button>
        </div>
        ${meetings.length ? `<div class="table-wrap"><table>
          <caption class="sr-only">Recurring meetings</caption>
          <thead><tr><th scope="col">Meeting</th><th scope="col">When</th><th scope="col">Dates</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${meetings.map(meetingRow).join("")}</tbody></table></div>
          <p class="small muted">Google Calendar links can't skip break days. The .ics files skip them.</p>`
          : `<div class="empty"><p>No recurring meetings yet. <a href="plan.html#meetings">Add one</a>.</p></div>`}
      </section>`;

    drawMonth();
    $$("[data-view]").forEach((b) => (b.onclick = () => {
      $$("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $("#view-month").classList.toggle("hidden", b.dataset.view !== "month");
      $("#view-google").classList.toggle("hidden", b.dataset.view !== "google");
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
