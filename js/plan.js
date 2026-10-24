/*
 * Semester plan: a week-by-week table for one semester (from config.js),
 * plus the editor for recurring meetings (stored in the "Meetings" tab).
 */
(function () {
  "use strict";
  const { $, $$, esc, icon, today, parseDate, addDays, fmtDate, fmtTime, fmtTimeRange, location: loc, DOW, slugify, cateringRules, statusItems, toast, download } = window.App;
  const content = $("#content");
  const SEMS = CONFIG.semesters;

  let events = [], meetings = [];
  let sem = pickSemester();

  function pickSemester() {
    const t = today();
    return SEMS.find((s) => t >= s.start && t <= s.end) || SEMS.find((s) => s.start > t) || SEMS[SEMS.length - 1];
  }

  const mondayOf = (iso) => { const d = parseDate(iso).getDay(); return addDays(iso, d === 0 ? -6 : 1 - d); };
  const overlaps = (a1, a2, b1, b2) => a1 < (b2 || b1) && b1 < (a2 || a1);
  const shortDay = (iso) => DOW[parseDate(iso).getDay()].slice(0, 3);

  /* ---------- week-by-week ---------- */
  function buildWeeks() {
    const weeks = [];
    const t = today();
    for (let wk = mondayOf(sem.start), n = 1; wk <= sem.end; wk = addDays(wk, 7), n++) {
      const end = addDays(wk, 6);
      const occ = meetings.flatMap((m) => Cal.meetingDates(m, wk, end).map((o) => ({ ...o, m })))
        .sort((a, b) => (a.date + a.m.startTime).localeCompare(b.date + b.m.startTime));
      const evs = events.filter((e) => e.date >= wk && e.date <= end).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
      const breaks = [...new Set([0, 1, 2, 3, 4].map((i) => Cal.breakOn(addDays(wk, i))).filter(Boolean).map((b) => b.name))];
      const allBreak = [0, 1, 2, 3, 4].every((i) => Cal.breakOn(addDays(wk, i)));

      const flags = [];
      for (const b of breaks) flags.push(["", b]);
      for (const e of evs) {
        for (const o of occ) {
          if (!o.skipped && o.date === e.date && overlaps(e.startTime, e.endTime, o.m.startTime, o.m.endTime)) {
            flags.push(["warn", `“${e.title}” overlaps ${o.m.title}`]);
          }
        }
        const r = cateringRules(e);
        if (e.date >= t && r.overLimit) flags.push(["warn", `“${e.title}”: ${e.attendance} people, so University Catering must cater`]);
        else if (e.date >= t && r.needsFror && !e.frorSent) flags.push(["caution", `“${e.title}”: catering FRoR email not sent`]);
        if (e.date >= t && !e.posterMade && (parseDate(e.date) - parseDate(t)) / 86400000 <= 14) flags.push(["caution", `“${e.title}”: no poster yet`]);
      }
      weeks.push({ n, wk, end, occ, evs, flags, allBreak, open: !evs.length && !allBreak, isNow: t >= wk && t <= end });
    }
    return weeks;
  }

  function weekRow(w) {
    return `<tr class="${w.allBreak ? "is-break" : ""} ${w.isNow ? "is-now" : ""}">
      <td>${w.n}${w.isNow ? ' <span class="chip chip--ink">now</span>' : ""}</td>
      <td>${esc(parseDate(w.wk).toLocaleDateString("en-US", { month: "short", day: "numeric" }))} – ${esc(parseDate(w.end).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}</td>
      <td><ul>${w.occ.map((o) => o.skipped
        ? `<li><s>${shortDay(o.date)} ${esc(o.m.title)}</s> <span class="muted">(${esc(o.skipped)})</span></li>`
        : `<li>${shortDay(o.date)} ${esc(fmtTime(o.m.startTime))} ${esc(o.m.title)}</li>`).join("") || '<li class="muted">—</li>'}</ul></td>
      <td><ul>${w.evs.map((e) => {
        const items = statusItems(e), done = items.filter((i) => i.done).length;
        return `<li>${shortDay(e.date)} <a href="event.html?id=${encodeURIComponent(e.id)}">${esc(e.title)}</a> <span class="chip${done === items.length ? " chip--live" : ""}">${done}/${items.length}</span></li>`;
      }).join("")}${w.open ? `<li><a href="event.html?date=${addDays(w.wk, 3)}">+ add event</a></li>` : ""}</ul></td>
      <td>${w.flags.map(([k, m]) => `<span class="flag${k ? " flag--" + k : ""}">${esc(m)}</span>`).join("") || (w.open ? '<span class="muted">open week</span>' : "")}</td>
    </tr>`;
  }

  /* ---------- meetings editor ---------- */
  function meetingsTable() {
    if (!meetings.length) return `<div class="empty">No recurring meetings yet. Add one below.</div>`;
    return `<div class="table-wrap"><table>
      <thead><tr><th>Meeting</th><th>When</th><th>Dates</th><th>Skips</th><th></th></tr></thead>
      <tbody>${meetings.map((m) => `<tr>
        <td><strong>${esc(m.title)}</strong><br><span class="muted">${esc(loc(m))}</span></td>
        <td>${m.frequency === "biweekly" ? "Every other" : "Every"} ${esc(DOW[m.weekday])}<br>${esc(fmtTimeRange(m.startTime, m.endTime))}</td>
        <td class="mono">${esc(fmtDate(m.firstDate, "numeric"))} – ${esc(fmtDate(m.lastDate, "numeric"))}</td>
        <td class="mono">${esc(m.skipDates) || "—"}</td>
        <td><div class="row">
          <button class="btn btn--sm btn--plain" data-edit="${esc(m.id)}">${icon("edit")} Edit</button>
          <button class="btn btn--sm btn--plain" data-ics="${esc(m.id)}">${icon("calendar")} .ics</button>
          <button class="btn btn--sm btn--danger" data-del="${esc(m.id)}">${icon("trash")}</button>
        </div></td></tr>`).join("")}</tbody></table></div>`;
  }

  function resetMeetingForm(m) {
    const f = $("#meeting-form");
    f.reset();
    const rec = m || { firstDate: sem.start, lastDate: sem.end, weekday: 2, frequency: "weekly" };
    for (const el of f.elements) if (el.name && el.name in rec) el.value = rec[el.name] ?? "";
    $("#meeting-legend").textContent = m ? "Edit: " + m.title : "Add a recurring meeting";
  }

  async function saveMeeting(e) {
    e.preventDefault();
    const f = e.target;
    if (!f.reportValidity()) return;
    const rec = Object.fromEntries([...new FormData(f).entries()].map(([k, v]) => [k, String(v).trim()]));
    rec.weekday = Number(rec.weekday);
    if (rec.lastDate < rec.firstDate) return toast("Last date is before the first date.", "danger");
    if (!rec.id) {
      const ids = new Set(meetings.map((m) => m.id));
      let id = slugify(rec.title), n = 2;
      while (ids.has(id)) id = slugify(rec.title) + "-" + n++;
      rec.id = id;
    }
    try {
      const existing = meetings.find((m) => m.id === rec.id);
      await Store.save("meetings", { ...(existing || {}), ...rec });
      meetings = await Store.list("meetings");
      toast("Meeting saved");
      render();
    } catch (err) { toast(err.message, "danger"); }
  }

  /* ---------- render ---------- */
  function render() {
    const weeks = buildWeeks();
    const scheduled = weeks.reduce((n, w) => n + w.occ.filter((o) => !o.skipped).length, 0);
    const open = weeks.filter((w) => w.open && w.end >= today()).length;
    const warnings = weeks.reduce((n, w) => n + w.flags.filter(([k]) => k).length, 0);

    content.innerHTML = `
      <div class="row">
        <label class="field" style="min-width: 220px"><span>Semester</span>
          <select id="sem">${SEMS.map((s) => `<option${s === sem ? " selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label>
        <div class="row" style="align-self: flex-end">
          <span class="chip">${weeks.length} weeks</span>
          <span class="chip">${scheduled} meetings</span>
          <span class="chip">${weeks.reduce((n, w) => n + w.evs.length, 0)} events</span>
          <span class="chip">${open} open weeks ahead</span>
          <span class="chip${warnings ? " chip--signal" : ""}">${warnings} need attention</span>
        </div>
      </div>
      <p class="muted">${esc(fmtDate(sem.start))} – ${esc(fmtDate(sem.end))}. ⚠ Check these dates against the official MSU academic calendar and update <code>config.js</code> if needed.</p>
      <div class="table-wrap plan"><table>
        <thead><tr><th>Wk</th><th>Dates</th><th>Meetings</th><th>Events</th><th>Notes</th></tr></thead>
        <tbody>${weeks.map(weekRow).join("")}</tbody>
      </table></div>

      <section class="stack" id="meetings">
        <div class="eyebrow">Recurring meetings</div>
        ${meetingsTable()}
        <fieldset><legend id="meeting-legend">Add a recurring meeting</legend><div id="meeting-form-slot"></div></fieldset>
      </section>`;

    $("#meeting-form-slot").appendChild($("#meeting-form-template").content.cloneNode(true));
    $("#meeting-form [name=weekday]").innerHTML = DOW.map((d, i) => `<option value="${i}">${d}</option>`).join("");
    $("#buildings").innerHTML = CONFIG.buildings.map((b) => `<option value="${esc(b)}">`).join("");
    resetMeetingForm();

    $("#sem").onchange = (e) => { sem = SEMS[e.target.selectedIndex]; render(); };
    $("#meeting-form").onsubmit = saveMeeting;
    $("#meeting-cancel").onclick = () => resetMeetingForm();
    $$("[data-edit]").forEach((b) => (b.onclick = () => {
      resetMeetingForm(meetings.find((m) => m.id === b.dataset.edit));
      $("#meeting-form").scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    $$("[data-ics]").forEach((b) => (b.onclick = () => {
      const m = meetings.find((x) => x.id === b.dataset.ics);
      download("meeting-" + m.id + ".ics", Cal.meetingIcs(m), "text/calendar");
    }));
    $$("[data-del]").forEach((b) => (b.onclick = async () => {
      const m = meetings.find((x) => x.id === b.dataset.del);
      if (!confirm(`Delete the recurring meeting “${m.title}”?`)) return;
      try { await Store.remove("meetings", m.id); meetings = await Store.list("meetings"); render(); toast("Deleted"); }
      catch (err) { toast(err.message, "danger"); }
    }));
    if (location.hash === "#meetings") $("#meetings").scrollIntoView();
  }

  App.withData(content, async () => {
    if (!sem) { content.innerHTML = `<div class="empty">No semesters in config.js yet.</div>`; return; }
    [events, meetings] = await Promise.all([Store.list("events"), Store.list("meetings")]);
    render();
  });
})();
