/*
 * Calendar helpers:
 *   - expanding recurring meetings into dates (skipping semester breaks)
 *   - "Add to calendar": .ics files and Google Calendar links
 *   - rendering a month grid
 */
(function () {
  "use strict";
  const C = window.CONFIG;
  const { esc, parseDate, isoDate, addDays, fmtTime, location: loc } = window.App;
  const TZ = C.club.timeZone;

  /* ---------- semesters & breaks ---------- */

  /** The configured break (if any) that covers this date. */
  function breakOn(date) {
    for (const s of C.semesters) {
      for (const b of s.breaks || []) if (date >= b.start && date <= b.end) return b;
    }
    return null;
  }
  const semesterFor = (date) => C.semesters.find((s) => date >= s.start && date <= s.end) || null;

  /* ---------- recurring meetings ---------- */

  const skipList = (m) => String(m.skipDates || "").split(/[\s,]+/).filter(Boolean);

  /**
   * Every scheduled date of a meeting between `from` and `to` (inclusive).
   * Returns [{ date, skipped: false | "reason" }].
   */
  function meetingDates(m, from, to) {
    if (!m.firstDate || m.weekday === "" || m.weekday == null) return [];
    const step = m.frequency === "biweekly" ? 14 : 7;
    // First matching weekday on/after firstDate anchors the series.
    let d = m.firstDate;
    while (parseDate(d).getDay() !== Number(m.weekday)) d = addDays(d, 1);
    const last = m.lastDate || addDays(m.firstDate, 366);
    const skips = skipList(m);
    const out = [];
    for (; d <= last && d <= to; d = addDays(d, step)) {
      if (d < from) continue;
      const br = breakOn(d);
      out.push({ date: d, skipped: skips.includes(d) ? "skipped" : br ? br.name : false });
    }
    return out;
  }

  /* ---------- .ics ---------- */

  const icsEsc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const icsLocal = (date, time) => date.replace(/-/g, "") + "T" + (time || "00:00").replace(":", "") + "00";
  const icsUtcNow = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

  // Lines longer than 75 bytes must be folded (RFC 5545 §3.1). Count UTF-8
  // bytes, not characters, so "—" and accented letters don't overflow.
  const bytes = (ch) => new TextEncoder().encode(ch).length;
  function fold(line) {
    const out = [];
    let cur = "", n = 0;
    for (const ch of line) {
      const b = bytes(ch);
      if (n + b > 74) { out.push(cur); cur = " "; n = 1; }
      cur += ch; n += b;
    }
    out.push(cur);
    return out.join("\r\n");
  }

  // Time zone definition so every calendar app reads times as Mountain Time.
  const VTIMEZONE_DENVER = [
    "BEGIN:VTIMEZONE", "TZID:America/Denver",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0700", "TZOFFSETTO:-0600", "TZNAME:MDT",
    "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:-0600", "TZOFFSETTO:-0700", "TZNAME:MST",
    "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
    "END:VTIMEZONE",
  ];

  /** End date: if the end time is before the start time, it's the next day. */
  const endDate = (date, start, end) => (end && start && end <= start ? addDays(date, 1) : date);

  function wrapIcs(vevent) {
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//" + C.club.name + "//Club Admin//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      ...(TZ === "America/Denver" ? VTIMEZONE_DENVER : []),
      ...vevent,
      "END:VCALENDAR",
    ].map(fold).join("\r\n") + "\r\n";
  }

  function eventVevent(ev) {
    const end = ev.endTime || ev.startTime;
    return [
      "BEGIN:VEVENT",
      "UID:" + ev.id + "@" + (location.hostname || "club-admin"),
      "DTSTAMP:" + icsUtcNow(),
      `DTSTART;TZID=${TZ}:` + icsLocal(ev.date, ev.startTime),
      `DTEND;TZID=${TZ}:` + icsLocal(endDate(ev.date, ev.startTime, end), end),
      "SUMMARY:" + icsEsc(ev.title),
      "DESCRIPTION:" + icsEsc(ev.description),
      "LOCATION:" + icsEsc(loc(ev)),
      "END:VEVENT",
    ];
  }

  const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  function meetingRule(m, first) {
    const interval = m.frequency === "biweekly" ? 2 : 1;
    let rule = `RRULE:FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${BYDAY[Number(m.weekday)]}`;
    // UNTIL is in UTC; the day after lastDate at 06:59Z is still before any
    // next-week occurrence in Mountain Time, so it safely includes lastDate.
    if (m.lastDate) rule += ";UNTIL=" + addDays(m.lastDate, 1).replace(/-/g, "") + "T065959Z";
    return rule;
  }

  function meetingVevent(m) {
    const dates = meetingDates(m, m.firstDate, m.lastDate || addDays(m.firstDate, 366));
    if (!dates.length) return null;
    const first = dates[0].date;
    const exdates = dates.filter((d) => d.skipped).map((d) => icsLocal(d.date, m.startTime));
    return [
      "BEGIN:VEVENT",
      "UID:meeting-" + m.id + "@" + (location.hostname || "club-admin"),
      "DTSTAMP:" + icsUtcNow(),
      `DTSTART;TZID=${TZ}:` + icsLocal(first, m.startTime),
      `DTEND;TZID=${TZ}:` + icsLocal(endDate(first, m.startTime, m.endTime), m.endTime || m.startTime),
      meetingRule(m, first),
      ...(exdates.length ? [`EXDATE;TZID=${TZ}:` + exdates.join(",")] : []),
      "SUMMARY:" + icsEsc(C.club.name + " — " + m.title),
      "DESCRIPTION:" + icsEsc(m.notes),
      "LOCATION:" + icsEsc(loc(m)),
      "END:VEVENT",
    ];
  }

  const eventIcs = (ev) => wrapIcs(eventVevent(ev));
  const meetingIcs = (m) => { const v = meetingVevent(m); return v ? wrapIcs(v) : null; };
  /** One .ics file containing many events and meetings. */
  const combinedIcs = (events, meetings) =>
    wrapIcs([...events.flatMap(eventVevent), ...meetings.map(meetingVevent).filter(Boolean).flat()]);

  /* ---------- Google Calendar links ---------- */

  function googleLink({ title, details, location, date, start, end, recur }) {
    const e = end || start;
    const p = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: icsLocal(date, start) + "/" + icsLocal(endDate(date, start, e), e),
      ctz: TZ,
      details: details || "",
      location: location || "",
    });
    if (recur) p.set("recur", recur);
    return "https://calendar.google.com/calendar/render?" + p.toString();
  }

  const eventGoogleLink = (ev) =>
    googleLink({ title: ev.title, details: ev.description, location: loc(ev), date: ev.date, start: ev.startTime, end: ev.endTime });

  /** Note: Google's link can't carry skipped dates — use the .ics for exact breaks. */
  function meetingGoogleLink(m) {
    const dates = meetingDates(m, m.firstDate, m.lastDate || addDays(m.firstDate, 366));
    if (!dates.length) return null;
    return googleLink({
      title: C.club.name + " — " + m.title, details: m.notes, location: loc(m),
      date: dates[0].date, start: m.startTime, end: m.endTime, recur: meetingRule(m, dates[0].date),
    });
  }

  /* ---------- month grid ---------- */

  /**
   * Draw a month into `el`.
   * items: [{ date, kind: "event"|"meeting"|"break", label, title?, href? }]
   * onNav(deltaMonths) is called by the prev/next buttons.
   */
  function renderMonth(el, year, month, items, onNav) {
    const first = new Date(year, month, 1);
    const start = addDays(isoDate(first), -first.getDay());
    const t = isoDate(new Date());
    const byDate = {};
    for (const it of items) (byDate[it.date] = byDate[it.date] || []).push(it);
    const order = { break: 0, meeting: 1, event: 2 };
    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const inMonth = parseDate(d).getMonth() === month;
      if (i === 35 && !inMonth) break; // drop a trailing all-next-month row
      const list = (byDate[d] || []).sort((a, b) => order[a.kind] - order[b.kind] || String(a.time).localeCompare(String(b.time)));
      const cls = ["cal__day", inMonth ? "" : "is-other", d === t ? "is-today" : "", breakOn(d) ? "is-break" : ""].join(" ");
      cells += `<div class="${cls}"><span class="cal__num"><span aria-hidden="true">${parseDate(d).getDate()}</span><span class="sr-only">${parseDate(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${d === t ? " (today)" : ""}</span></span>` +
        list.map((it) => {
          const tag = it.href ? "a" : "span";
          return `<${tag} class="cal__item cal__item--${it.kind}"${it.href ? ` href="${esc(it.href)}"` : ""} title="${esc(it.title || it.label)}">${esc(it.label)}</${tag}>`;
        }).join("") + `</div>`;
    }
    el.innerHTML = `
      <div class="cal">
        <div class="cal__head">
          <h2 class="cal__title" aria-live="polite">${first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          <div class="row">
            <button class="btn btn--secondary btn--sm" data-nav="-1">${App.icon("left")} Previous</button>
            <button class="btn btn--secondary btn--sm" data-nav="0">Today</button>
            <button class="btn btn--secondary btn--sm" data-nav="1">Next ${App.icon("right")}</button>
          </div>
        </div>
        <div class="cal__grid">
          ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="cal__dow" aria-hidden="true">${d}</div>`).join("")}
          ${cells}
        </div>
      </div>`;
    el.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => onNav(Number(b.dataset.nav))));
  }

  /** Build calendar items for a date range from events + meetings + breaks. */
  function calendarItems(events, meetings, from, to) {
    const items = [];
    for (const ev of events) {
      if (ev.date < from || ev.date > to) continue;
      items.push({ date: ev.date, kind: "event", time: ev.startTime, label: fmtTime(ev.startTime) + " " + ev.title, title: ev.title + " — " + loc(ev), href: "event.html?id=" + encodeURIComponent(ev.id) });
    }
    for (const m of meetings) {
      for (const occ of meetingDates(m, from, to)) {
        if (occ.skipped) continue;
        items.push({ date: occ.date, kind: "meeting", time: m.startTime, label: fmtTime(m.startTime) + " " + m.title, title: m.title + " — " + loc(m), href: "plan.html#meetings" });
      }
    }
    for (const s of C.semesters) {
      for (const b of s.breaks || []) {
        for (let d = b.start; d <= b.end; d = addDays(d, 1)) if (d >= from && d <= to) items.push({ date: d, kind: "break", label: b.name });
      }
    }
    return items;
  }

  window.Cal = {
    breakOn, semesterFor, meetingDates,
    eventIcs, meetingIcs, combinedIcs, eventGoogleLink, meetingGoogleLink,
    renderMonth, calendarItems,
  };
})();
