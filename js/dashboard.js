/*
 * Dashboard: upcoming and past events, each with its status checklist.
 * Ticking a checkbox saves straight to the spreadsheet.
 */
(function () {
  "use strict";
  const { $, $$, esc, icon, alert, badge, today, daysBetween, parseDate, fmtDate, fmtTimeRange, location: loc, cateringRules, statusItems, toast, download } = window.App;
  const content = $("#content");
  let events = [];

  const when = (days) => (days === 0 ? "Today" : days === 1 ? "Tomorrow" : days > 0 ? `In ${days} days` : `${-days} days ago`);

  function eventCard(ev) {
    const items = statusItems(ev);
    const done = items.filter((i) => i.done).length;
    const rules = cateringRules(ev);
    const days = daysBetween(today(), ev.date);
    const d = parseDate(ev.date);
    const q = "?id=" + encodeURIComponent(ev.id);
    const headId = "ev-" + ev.id;

    const alerts = [];
    if (rules.overLimit) alerts.push(alert("danger", `${esc(ev.attendance)} people expected`, `University Catering must cater groups of ${CONFIG.catering.attendanceLimit} or more.`));
    else if (rules.needsFror && !ev.frorSent && days >= 0) alerts.push(alert("warning", "Catering email not sent", "Ask University Catering before ordering from an outside vendor."));

    return `
      <li class="card" aria-labelledby="${esc(headId)}">
        <div class="event-head">
          <div class="date-block" aria-hidden="true">
            <div class="dow">${d.toLocaleDateString("en-US", { month: "short" })}</div>
            <div class="day">${d.getDate()}</div>
          </div>
          <div>
            <div class="row row--between" style="gap: 4px 12px">
              <h3 id="${esc(headId)}">${esc(ev.title)}</h3>
              ${badge(when(days), days <= 7 ? "signal" : "neutral")}
            </div>
            <p><span class="sr-only">${esc(fmtDate(ev.date))}, </span>${esc(fmtTimeRange(ev.startTime, ev.endTime))} · ${esc(loc(ev)) || "No location yet"}</p>
          </div>
        </div>
        <dl class="details">
          <dt>Expected</dt><dd>${ev.attendance ? esc(ev.attendance) + " people" : "Not set"}</dd>
          <dt>Food</dt><dd>${ev.hasFood ? esc(ev.vendor || "Yes, vendor not set") : "None"}${rules.exempt ? " (no catering email needed)" : ""}</dd>
          <dt>Organizer</dt><dd>${esc(ev.organizerName) || "Not set"}${ev.organizerRole ? ", " + esc(ev.organizerRole) : ""}</dd>
        </dl>
        ${alerts.join("")}
        <div class="status">
          <div class="row row--between"><strong style="color: var(--web-ink)">Status</strong><span class="small muted">${done} of ${items.length} done</span></div>
          <div class="progress" aria-hidden="true"><div style="width:${items.length ? (done / items.length) * 100 : 0}%"></div></div>
          <ul class="checklist">
            ${items.map((i) => `<li><label class="check"><input type="checkbox" data-id="${esc(ev.id)}" data-key="${i.key}"${i.done ? " checked" : ""}> ${i.label}</label></li>`).join("")}
          </ul>
        </div>
        <div class="row">
          <a class="btn btn--secondary btn--sm" href="event.html${q}">${icon("edit")} Edit</a>
          <a class="btn btn--secondary btn--sm" href="poster.html${q}">${icon("print")} Poster</a>
          ${rules.needsFror ? `<a class="btn btn--secondary btn--sm" href="fror.html${q}">${icon("mail")} Catering email</a>` : ""}
          <button class="btn btn--ghost btn--sm" data-ics="${esc(ev.id)}">Download .ics</button>
          <a class="btn btn--ghost btn--sm" href="${esc(Cal.eventGoogleLink(ev))}" target="_blank" rel="noopener">Google Calendar<span class="sr-only"> (opens in a new tab)</span></a>
        </div>
      </li>`;
  }

  function pastRow(ev) {
    const items = statusItems(ev);
    const done = items.filter((i) => i.done).length;
    return `<tr>
      <td>${esc(fmtDate(ev.date, "numeric"))}</td>
      <td><a href="event.html?id=${encodeURIComponent(ev.id)}">${esc(ev.title)}</a></td>
      <td>${esc(loc(ev))}</td>
      <td>${esc(ev.attendance)}</td>
      <td>${done === items.length ? badge("Complete", "ink") : badge(`${done} of ${items.length}`)}</td>
    </tr>`;
  }

  function render() {
    const t = today();
    const upcoming = events.filter((e) => e.date >= t).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    const past = events.filter((e) => e.date < t).sort((a, b) => b.date.localeCompare(a.date));

    content.innerHTML = `
      <section class="stack" aria-labelledby="up-h">
        <div class="section-head">
          <div><h2 id="up-h">Upcoming events</h2><p role="status">${upcoming.length} upcoming</p></div>
          <button class="btn btn--secondary btn--sm" id="export">${icon("download")} Back up all data (JSON)</button>
        </div>
        ${upcoming.length ? `<ul class="grid" style="list-style: none; margin: 0; padding: 0">${upcoming.map(eventCard).join("")}</ul>`
          : `<div class="empty"><p>No upcoming events. Use <strong>New event</strong> in the header to add one.</p></div>`}
      </section>
      <section class="stack" aria-labelledby="past-h">
        <h2 id="past-h">Past events</h2>
        ${past.length ? `<div class="table-wrap"><table>
          <thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Where</th><th scope="col">Expected</th><th scope="col">Status</th></tr></thead>
          <tbody>${past.map(pastRow).join("")}</tbody></table></div>`
          : `<div class="empty"><p>No past events yet.</p></div>`}
      </section>`;

    $$("input[type=checkbox][data-key]", content).forEach((cb) => {
      cb.onchange = async () => {
        cb.disabled = true;
        try {
          const saved = await Store.patch("events", cb.dataset.id, { [cb.dataset.key]: cb.checked });
          events = events.map((e) => (e.id === saved.id ? saved : e));
          const key = cb.dataset.key, id = cb.dataset.id;
          render();
          // keep keyboard focus on the box that was just toggled
          const again = content.querySelector(`input[data-id="${CSS.escape(id)}"][data-key="${key}"]`);
          if (again) again.focus();
          toast("Saved.");
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
    $("#export").onclick = async () => {
      try {
        const [ev, mt] = await Promise.all([Store.list("events"), Store.list("meetings")]);
        download(`club-backup-${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), events: ev, meetings: mt }, null, 2), "application/json");
      } catch (e) { toast(e.message, "danger"); }
    };
  }

  App.withData(content, async () => {
    events = await Store.list("events");
    render();
  });
})();
