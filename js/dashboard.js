/*
 * Dashboard: upcoming and past events, each with its status checklist.
 * Ticking a checkbox saves straight to the spreadsheet.
 */
(function () {
  "use strict";
  const { $, $$, esc, icon, today, daysBetween, fmtDate, fmtTimeRange, location: loc, cateringRules, statusItems, toast, download } = window.App;
  const content = $("#content");
  let events = [];

  function eventCard(ev) {
    const items = statusItems(ev);
    const done = items.filter((i) => i.done).length;
    const rules = cateringRules(ev);
    const days = daysBetween(today(), ev.date);
    const q = "?id=" + encodeURIComponent(ev.id);

    const alerts = [];
    if (rules.overLimit) alerts.push(`<div class="alert alert--danger">${icon("warning")}<div>${esc(ev.attendance)} expected — University Catering must cater groups of ${CONFIG.catering.attendanceLimit}+.</div></div>`);
    if (rules.needsFror && !ev.frorSent && days >= 0) alerts.push(`<div class="alert alert--caution">${icon("mail")}<div>Catering FRoR email not sent yet.</div></div>`);

    return `
      <article class="card event-card">
        <div class="card__bar">
          <span class="date">${esc(fmtDate(ev.date, "short"))} · ${esc(fmtTimeRange(ev.startTime, ev.endTime))}</span>
          <span>${days === 0 ? "today" : days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : `${-days} days ago`}</span>
        </div>
        <div class="card__body">
          <h2>${esc(ev.title)}</h2>
          <dl class="meta">
            <dt>Where</dt><dd>${esc(loc(ev)) || "—"}</dd>
            <dt>Expected</dt><dd>${esc(ev.attendance) || "—"} people</dd>
            <dt>Food</dt><dd>${ev.hasFood ? esc(ev.vendor || "yes (vendor not set)") : "none"}${rules.exempt ? ' <span class="chip">FRoR exempt</span>' : ""}</dd>
            <dt>Organizer</dt><dd>${esc(ev.organizerName) || "—"}${ev.organizerRole ? ", " + esc(ev.organizerRole) : ""}</dd>
          </dl>
          ${alerts.join("")}
          <div class="stack" style="gap: var(--space-2)">
            <div class="row" style="justify-content: space-between">
              <span class="label">Status</span><span class="mono">${done}/${items.length}</span>
            </div>
            <div class="progress" aria-hidden="true"><div style="width:${items.length ? (done / items.length) * 100 : 0}%"></div></div>
            <ul class="checklist">
              ${items.map((i) => `<li><label class="${i.done ? "done" : ""}"><input type="checkbox" data-id="${esc(ev.id)}" data-key="${i.key}"${i.done ? " checked" : ""}> ${i.label}</label></li>`).join("")}
            </ul>
          </div>
          <div class="row">
            <a class="btn btn--sm btn--plain" href="event.html${q}">${icon("edit")} Edit</a>
            <a class="btn btn--sm btn--plain" href="poster.html${q}">${icon("print")} Poster</a>
            ${rules.needsFror ? `<a class="btn btn--sm${ev.frorSent ? " btn--plain" : ""}" href="fror.html${q}">${icon("mail")} Catering email</a>` : ""}
            <button class="btn btn--sm btn--plain" data-ics="${esc(ev.id)}">${icon("calendar")} .ics</button>
            <a class="btn btn--sm btn--plain" href="${esc(Cal.eventGoogleLink(ev))}" target="_blank" rel="noopener">Google Cal</a>
          </div>
        </div>
      </article>`;
  }

  function pastRow(ev) {
    const items = statusItems(ev);
    const done = items.filter((i) => i.done).length;
    return `<tr>
      <td class="mono">${esc(fmtDate(ev.date, "numeric"))}</td>
      <td><a href="event.html?id=${encodeURIComponent(ev.id)}">${esc(ev.title)}</a></td>
      <td>${esc(loc(ev))}</td>
      <td>${esc(ev.attendance)}</td>
      <td>${done === items.length ? '<span class="chip chip--live">complete</span>' : `<span class="chip">${done}/${items.length}</span>`}</td>
    </tr>`;
  }

  function render() {
    const t = today();
    const upcoming = events.filter((e) => e.date >= t).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    const past = events.filter((e) => e.date < t).sort((a, b) => b.date.localeCompare(a.date));

    content.innerHTML = `
      <section class="stack">
        <div class="eyebrow">Upcoming · ${upcoming.length}</div>
        ${upcoming.length ? `<div class="grid">${upcoming.map(eventCard).join("")}</div>`
          : `<div class="empty">No upcoming events. <a href="event.html">Create one</a>.</div>`}
      </section>
      <section class="stack">
        <div class="eyebrow">Past · ${past.length}</div>
        ${past.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Event</th><th>Where</th><th>Expected</th><th>Status</th></tr></thead>
          <tbody>${past.map(pastRow).join("")}</tbody></table></div>`
          : `<div class="empty">No past events yet.</div>`}
      </section>`;

    $$("input[type=checkbox][data-key]", content).forEach((cb) => {
      cb.onchange = async () => {
        cb.disabled = true;
        try {
          const saved = await Store.patch("events", cb.dataset.id, { [cb.dataset.key]: cb.checked });
          events = events.map((e) => (e.id === saved.id ? saved : e));
          render();
          toast("Saved");
        } catch (e) {
          cb.checked = !cb.checked;
          cb.disabled = false;
          toast(e.message, "danger");
        }
      };
    });
    $$("[data-ics]", content).forEach((b) => {
      b.onclick = () => {
        const ev = events.find((e) => e.id === b.dataset.ics);
        download(ev.id + ".ics", Cal.eventIcs(ev), "text/calendar");
      };
    });
  }

  $("#export").onclick = () =>
    App.withData(content, async () => {
      const [ev, mt] = await Promise.all([Store.list("events"), Store.list("meetings")]);
      download(`club-backup-${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), events: ev, meetings: mt }, null, 2), "application/json");
      render();
    });

  App.withData(content, async () => {
    events = await Store.list("events");
    render();
  });
})();
