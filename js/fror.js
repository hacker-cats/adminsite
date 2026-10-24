/*
 * First Right of Refusal (FRoR) email builder.
 * Rules and template text come from CONFIG.catering / CONFIG.frorEmail in
 * config.js. Your edits to the preview are kept per event in this browser.
 */
(function () {
  "use strict";
  const { $, esc, icon, alert, param, today, daysBetween, fmtDate, fmtTime, location: loc, cateringRules, toast, copyText, eventOptions, parseDate, DOW } = window.App;
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
    const q = encodeURIComponent(e.id);
    if (!e.hasFood) out.push(alert("info", "No food, no email", "This event isn't serving food, so you don't need a first right of refusal."));
    else if (!e.vendor) out.push(alert("warning", "No vendor set", `<a href="event.html?id=${q}">Add the vendor</a> to see whether you need this email.`));
    if (r.exempt) out.push(alert("info", "No catering email needed", `${esc(e.vendor)} orders are exempt from the first right of refusal. You can order directly.`));
    if (r.overLimit) out.push(alert("danger", `${esc(e.attendance)} people expected`, `For groups of ${cat.attendanceLimit} or more, University Catering has to cater the event, so an outside vendor isn't an option. Contact Catering about catering it, or <a href="event.html?id=${q}">fix the headcount</a> if it was overestimated.`));
    if (e.hasFood) r.buildingWarnings.forEach((w) => out.push(alert("warning", "This building has its own food rules", esc(w))));
    return { html: out.join(""), show: r.needsFror };
  }

  function timing(e) {
    const dow = new Date().getDay();
    const days = daysBetween(today(), e.date);
    let msg = esc(cat.sendReminder);
    if (dow === 0 || dow >= 5) msg += ` Today is ${DOW[dow]}, so Catering probably won't see it until Monday.`;
    const title = days < 0 ? "This event has already happened"
      : `The event is ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`} (${DOW[parseDate(e.date).getDay()]})`;
    return alert(days < 7 ? "warning" : "info", title, msg);
  }

  /* ---------- render ---------- */
  function render() {
    const rules = alerts(ev);
    const d = loadDraft(ev);
    content.innerHTML = `
      <div class="field" style="max-width: 560px">
        <label for="ev">Event</label>
        <select id="ev">${eventOptions(events, ev.id)}</select>
      </div>
      ${rules.html}
      ${rules.show ? `
        ${timing(ev)}
        <section class="card" aria-labelledby="mail-h" style="max-width: 880px">
          <div class="card__head"><h2 id="mail-h" style="font-size: var(--web-size-h3)">Email</h2><span class="meta">Edit anything before you open it</span></div>
          ${d.stale ? alert("warning", "The event changed since you edited this email", "Select <strong>Reset to template</strong> to refill it. Your edits will be replaced.") : ""}
          <div class="field"><label for="to">To</label><input id="to" value="${esc(cat.email)}" readonly></div>
          <div class="field"><label for="subject">Subject</label><input id="subject" value="${esc(d.subject)}"></div>
          <div class="field"><label for="body">Message</label><textarea id="body" rows="20">${esc(d.body)}</textarea></div>
          <div class="row">
            <a class="btn" id="outlook" target="_blank" rel="noopener">${icon("mail", "onDark")} Open in Outlook<span class="sr-only"> (opens in a new tab)</span></a>
            <a class="btn btn--secondary" id="gmail" target="_blank" rel="noopener">Open in Gmail<span class="sr-only"> (opens in a new tab)</span></a>
            <a class="btn btn--secondary" id="mailto">Open in mail app</a>
          </div>
          <div class="row">
            <button class="btn btn--ghost btn--sm" id="copy">Copy message</button>
            <button class="btn btn--ghost btn--sm" id="copy-subject">Copy subject</button>
            <button class="btn btn--ghost btn--sm" id="reset">Reset to template</button>
          </div>
          <p class="small muted">MSU student email is Outlook. These buttons open a draft; you review it and press Send yourself. The default wording lives in <code>config.js</code> under <code>frorEmail</code>.</p>
        </section>
        <fieldset style="max-width: 880px">
          <legend>Status</legend>
          <div class="choices">
            <label class="check"><input type="checkbox" id="st-frorSent"${ev.frorSent ? " checked" : ""}> Catering email sent</label>
            <label class="check"><input type="checkbox" id="st-approvalReceived"${ev.approvalReceived ? " checked" : ""}> Catering replied, OK to order</label>
            <label class="check"><input type="checkbox" id="st-foodOrdered"${ev.foodOrdered ? " checked" : ""}> Food ordered</label>
          </div>
        </fieldset>` : ""}`;

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
          toast("Saved.");
        } catch (e) { cb.checked = !cb.checked; toast(e.message, "danger"); }
      };
    }
  }

  App.withData(content, async () => {
    events = await Store.list("events");
    if (!events.length) {
      content.innerHTML = `<div class="empty"><p>No events yet. <a href="event.html">Create one</a> first.</p></div>`;
      return;
    }
    const t = today();
    ev = events.find((e) => e.id === param("id")) ||
      events.filter((e) => e.date >= t && cateringRules(e).needsFror && !e.frorSent).sort((a, b) => a.date.localeCompare(b.date))[0] ||
      events[0];
    render();
  });
})();
