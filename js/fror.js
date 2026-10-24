/*
 * First Right of Refusal (FRoR) email builder.
 * Rules and template text come from CONFIG.catering / CONFIG.frorEmail in
 * config.js. Your edits to the preview are kept per event in this browser.
 */
(function () {
  "use strict";
  const { $, esc, icon, param, today, daysBetween, fmtDate, fmtTime, location: loc, cateringRules, toast, copyText, eventOptions, parseDate, DOW } = window.App;
  const content = $("#content");
  const cat = CONFIG.catering;
  const draftKey = (id) => "hc-admin-fror-draft:" + id;

  let events = [];
  let ev = null;

  /* ---------- template filling ---------- */
  function vars(e) {
    return {
      club: CONFIG.club.name,
      title: e.title, description: e.description,
      date: fmtDate(e.date), dateShort: fmtDate(e.date, "numeric"),
      startTime: fmtTime(e.startTime), endTime: fmtTime(e.endTime),
      building: e.building, room: e.room, location: loc(e),
      attendance: e.attendance, vendor: e.vendor,
      organizerName: e.organizerName, organizerRole: e.organizerRole,
      organizerPhone: e.organizerPhone, organizerEmail: e.organizerEmail,
    };
  }

  /**
   * Replace {{placeholders}}. A line made only of placeholders that are all
   * empty (e.g. a blank phone number) is dropped instead of left blank.
   */
  function fill(tpl, v) {
    return tpl.split("\n").map((line) => {
      const keys = [...line.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      const out = line.replace(/\{\{(\w+)\}\}/g, (_, k) => (v[k] ?? "") === "" ? "" : String(v[k]));
      if (keys.length && keys.every((k) => (v[k] ?? "") === "") && !out.replace(/[\s,.–-]/g, "")) return null;
      return out;
    }).filter((l) => l !== null).join("\n");
  }

  const fromTemplate = (e) => ({ subject: fill(CONFIG.frorEmail.subject, vars(e)), body: fill(CONFIG.frorEmail.body, vars(e)) });

  // A saved draft remembers which template text it started from ("basis"),
  // so we can tell you if the event details changed since you edited it.
  function loadDraft(e) {
    const fresh = fromTemplate(e);
    try {
      const d = JSON.parse(localStorage.getItem(draftKey(e.id)) || "null");
      if (d) return { ...d, stale: d.basis !== JSON.stringify(fresh) };
    } catch (err) {}
    return fresh;
  }
  const saveDraft = (e, d) => {
    try { localStorage.setItem(draftKey(e.id), JSON.stringify({ ...d, basis: JSON.stringify(fromTemplate(e)) })); } catch (err) {}
  };

  /* ---------- compose links ---------- */
  function links(subject, body) {
    const to = cat.email;
    const q = (o) => Object.entries(o).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    return {
      // MSU student email is Microsoft 365, so Outlook on the web uses outlook.office.com.
      outlook: "https://outlook.office.com/mail/deeplink/compose?" + q({ to, subject, body }),
      gmail: "https://mail.google.com/mail/?view=cm&fs=1&" + q({ to, su: subject, body }),
      mailto: "mailto:" + to + "?" + q({ subject, body: body.replace(/\r?\n/g, "\r\n") }),
    };
  }

  /* ---------- rule panel ---------- */
  function alerts(e) {
    const r = cateringRules(e);
    const out = [];
    const a = (k, i, m) => out.push(`<div class="alert alert--${k}">${icon(i)}<div>${m}</div></div>`);

    if (!e.hasFood) a("info", "info", "This event isn't serving food, so no First Right of Refusal email is needed.");
    else if (!e.vendor) a("caution", "warning", `No vendor set. <a href="event.html?id=${encodeURIComponent(e.id)}">Add the vendor</a> first.`);
    if (r.exempt) a("ok", "check", `<strong>${esc(e.vendor)}</strong> orders are exempt from the First Right of Refusal. You can order directly; no email needed.`);
    if (r.overLimit) a("danger", "warning", `<strong>${esc(e.attendance)} people expected.</strong> For groups of ${cat.attendanceLimit} or more, University Catering needs to cater the event itself, so an outside vendor isn't an option. Contact Catering about catering it, or lower the expected headcount if it was overestimated.`);
    if (e.hasFood) r.buildingWarnings.forEach((w) => a("caution", "warning", esc(w)));
    return { html: out.join(""), show: r.needsFror };
  }

  function timing(e) {
    const dow = new Date().getDay();
    const days = daysBetween(today(), e.date);
    let msg = esc(cat.sendReminder);
    if (dow === 0 || dow >= 5) msg += ` <strong>Today is ${DOW[dow]}</strong>, so Catering probably won't see this until Monday.`;
    if (days >= 0) msg += ` The event is <strong>${days} day${days === 1 ? "" : "s"}</strong> away (${esc(DOW[parseDate(e.date).getDay()])}).`;
    else msg += " <strong>This event has already happened.</strong>";
    return `<div class="alert alert--${days < 7 ? "caution" : "info"}">${icon("clock")}<div>${msg}</div></div>`;
  }

  /* ---------- render ---------- */
  function render() {
    const rules = alerts(ev);
    const d = loadDraft(ev);
    content.innerHTML = `
      <label class="field"><span>Event</span><select id="ev">${eventOptions(events, ev.id)}</select></label>
      ${rules.html}
      ${rules.show ? `
        ${timing(ev)}
        <div class="card">
          <div class="card__bar"><span>Email preview: edit anything</span><span>${icon("mail")}</span></div>
          <div class="card__body">
            ${d.stale ? `<div class="alert alert--caution">${icon("refresh")}<div>The event details changed since you last edited this email. Click <strong>Reset from template</strong> to refill it (your edits will be replaced).</div></div>` : ""}
            <label class="field"><span>To</span><input id="to" value="${esc(cat.email)}" readonly></label>
            <label class="field"><span>Subject</span><input id="subject" value="${esc(d.subject)}"></label>
            <label class="field"><span>Message</span><textarea id="body" rows="22">${esc(d.body)}</textarea></label>
            <div class="row">
              <a class="btn" id="outlook" target="_blank" rel="noopener">${icon("mail")} Open in Outlook (MSU)</a>
              <a class="btn btn--plain" id="gmail" target="_blank" rel="noopener">Open in Gmail</a>
              <a class="btn btn--plain" id="mailto">Mail app</a>
              <button class="btn btn--plain" id="copy">${icon("copy")} Copy message</button>
              <button class="btn btn--plain" id="copy-subject">Copy subject</button>
              <button class="btn btn--plain" id="reset">${icon("refresh")} Reset from template</button>
            </div>
            <p class="muted">These buttons only open a draft; you review it and press Send yourself. Edit the default wording in <code>config.js</code> → <code>frorEmail</code>.</p>
          </div>
        </div>
        <div class="card">
          <div class="card__bar"><span>Status</span></div>
          <div class="card__body">
            <div class="row">
              <label class="check"><input type="checkbox" id="st-frorSent"${ev.frorSent ? " checked" : ""}> I sent the FRoR email</label>
              <label class="check"><input type="checkbox" id="st-approvalReceived"${ev.approvalReceived ? " checked" : ""}> Catering replied / approval received</label>
              <label class="check"><input type="checkbox" id="st-foodOrdered"${ev.foodOrdered ? " checked" : ""}> Food ordered</label>
            </div>
          </div>
        </div>` : ""}`;

    $("#ev").onchange = (e) => {
      ev = events.find((x) => x.id === e.target.value);
      history.replaceState(null, "", "?id=" + encodeURIComponent(ev.id));
      render();
    };
    if (!rules.show) return;

    const refreshLinks = (save = true) => {
      const s = $("#subject").value, b = $("#body").value;
      const l = links(s, b);
      $("#outlook").href = l.outlook;
      $("#gmail").href = l.gmail;
      $("#mailto").href = l.mailto;
      if (save) saveDraft(ev, { subject: s, body: b });
    };
    $("#subject").oninput = () => refreshLinks();
    $("#body").oninput = () => refreshLinks();
    refreshLinks(false);
    $("#copy").onclick = () => copyText($("#body").value);
    $("#copy-subject").onclick = () => copyText($("#subject").value);
    $("#reset").onclick = () => {
      const t = fromTemplate(ev);
      $("#subject").value = t.subject;
      $("#body").value = t.body;
      try { localStorage.removeItem(draftKey(ev.id)); } catch (err) {}
      refreshLinks(false);
      render();
    };
    for (const key of ["frorSent", "approvalReceived", "foodOrdered"]) {
      const cb = $("#st-" + key);
      cb.onchange = async () => {
        try {
          ev = await Store.patch("events", ev.id, { [key]: cb.checked });
          events = events.map((x) => (x.id === ev.id ? ev : x));
          toast("Status saved");
        } catch (e) { cb.checked = !cb.checked; toast(e.message, "danger"); }
      };
    }
  }

  App.withData(content, async () => {
    events = await Store.list("events");
    if (!events.length) {
      content.innerHTML = `<div class="empty">No events yet. <a href="event.html">Create one</a> first.</div>`;
      return;
    }
    const t = today();
    ev = events.find((e) => e.id === param("id")) ||
      events.filter((e) => e.date >= t && cateringRules(e).needsFror && !e.frorSent).sort((a, b) => a.date.localeCompare(b.date))[0] ||
      events[0];
    render();
  });
})();
