/*
 * Create / edit an event.
 *   event.html             -> new event
 *   event.html?id=<id>     -> edit an existing event
 *   event.html?date=<iso>  -> new event with the date pre-filled
 *
 * While you type, the form is saved as a draft in localStorage. The draft is
 * cleared once the event is saved to the spreadsheet.
 */
(function () {
  "use strict";
  const { $, esc, icon, param, slugify, cateringRules, toast, download, fmtDate } = window.App;
  const content = $("#content");
  const editId = param("id");
  const DRAFT_KEY = "hc-admin-draft:" + (editId || "new");
  const BOOLS = ["posterMade", "frorSent", "approvalReceived", "foodOrdered"];

  let form, existing = null;

  /* ---------- form <-> record ---------- */
  function readForm() {
    const f = new FormData(form);
    const rec = {};
    for (const [k, v] of f.entries()) rec[k] = typeof v === "string" ? v.trim() : v;
    rec.hasFood = rec.hasFood === "yes";
    if (!rec.hasFood) rec.vendor = "";
    rec.attendance = rec.attendance ? Number(rec.attendance) : "";
    for (const b of BOOLS) rec[b] = form.elements[b].checked;
    return rec;
  }

  function fillForm(rec) {
    for (const el of form.elements) {
      if (!el.name || !(el.name in rec)) continue;
      if (el.type === "checkbox") el.checked = !!rec[el.name];
      else if (el.type === "radio") el.checked = el.value === (rec.hasFood ? "yes" : "no");
      else el.value = rec[el.name] ?? "";
    }
  }

  /* ---------- drafts ---------- */
  const saveDraft = () => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), data: readForm() })); } catch (e) {}
  };
  const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; } };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} };

  /* ---------- live catering hints ---------- */
  function updateRules() {
    const rec = readForm();
    $("#vendor-field").classList.toggle("hidden", !rec.hasFood);
    const r = cateringRules(rec);
    const out = [];
    if (rec.hasFood && !rec.vendor) out.push(["info", "info", "Enter the vendor to see whether you need a First Right of Refusal email."]);
    if (r.exempt) out.push(["ok", "check", `${esc(rec.vendor)} is exempt — no First Right of Refusal email needed.`]);
    if (r.needsFror && !r.overLimit) out.push(["caution", "mail", `Outside vendor: you'll need to email University Catering for a <strong>First Right of Refusal</strong> before ordering. You can do that right after saving.`]);
    if (r.overLimit) out.push(["danger", "warning", `<strong>${esc(rec.attendance)} expected.</strong> For groups of ${CONFIG.catering.attendanceLimit} or more, MSU University Catering must cater the event — an outside vendor isn't allowed.`]);
    if (rec.hasFood) for (const w of r.buildingWarnings) out.push(["caution", "warning", esc(w)]);
    $("#rules").innerHTML = out.map(([k, i, m]) => `<div class="alert alert--${k}">${icon(i)}<div>${m}</div></div>`).join("");
  }

  /* ---------- save ---------- */
  async function uniqueId(rec) {
    const base = rec.date + "-" + slugify(rec.title);
    const ids = new Set((await Store.list("events")).map((e) => e.id));
    let id = base, n = 2;
    while (ids.has(id)) id = base + "-" + n++;
    return id;
  }

  function showSaved(ev) {
    const r = cateringRules(ev);
    const q = "?id=" + encodeURIComponent(ev.id);
    content.innerHTML = `
      <div class="alert alert--ok">${icon("check")}<div><strong>Saved “${esc(ev.title)}”</strong> for ${esc(fmtDate(ev.date))}.</div></div>
      <div class="card"><div class="card__bar"><span>Next steps</span></div><div class="card__body">
        <div class="row">
          <a class="btn" href="poster.html${q}">${icon("print")} Make the poster</a>
          ${r.needsFror ? `<a class="btn" href="fror.html${q}">${icon("mail")} Write the catering email</a>` : ""}
          <button class="btn btn--plain" id="ics">${icon("calendar")} Add to calendar (.ics)</button>
          <a class="btn btn--plain" target="_blank" rel="noopener" href="${esc(Cal.eventGoogleLink(ev))}">Google Calendar</a>
          <a class="btn btn--plain" href="event.html${q}">${icon("edit")} Keep editing</a>
          <a class="btn btn--plain" href="index.html">Dashboard</a>
        </div>
      </div></div>`;
    $("#ics").onclick = () => download(ev.id + ".ics", Cal.eventIcs(ev), "text/calendar");
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const rec = readForm();
    if (rec.endTime && rec.startTime && rec.endTime <= rec.startTime &&
        !confirm("The end time is before the start time. Does this event run past midnight?")) return;
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      rec.id = existing ? existing.id : await uniqueId(rec);
      const saved = await Store.save("events", { ...(existing || {}), ...rec });
      clearDraft();
      if (!existing) history.replaceState(null, "", "event.html?id=" + encodeURIComponent(saved.id));
      showSaved(saved);
    } catch (err) {
      btn.disabled = false;
      toast(err.message, "danger");
    }
  }

  async function onDelete() {
    if (!confirm(`Delete “${existing.title}”? This removes its row from the spreadsheet.`)) return;
    try {
      await Store.remove("events", existing.id);
      clearDraft();
      location.href = "index.html";
    } catch (err) { toast(err.message, "danger"); }
  }

  /* ---------- boot ---------- */
  App.withData(content, async () => {
    if (editId) {
      existing = await Store.get("events", editId);
      if (!existing) {
        content.innerHTML = `<div class="alert alert--danger">${icon("warning")}<div>No event with id <code>${esc(editId)}</code>. <a href="index.html">Back to dashboard</a></div></div>`;
        return;
      }
      $("#page-title").textContent = ">_ edit event";
    }

    content.innerHTML = "";
    content.appendChild($("#form-template").content.cloneNode(true));
    form = $("#event-form");
    $("#buildings").innerHTML = CONFIG.buildings.map((b) => `<option value="${esc(b)}">`).join("");

    if (existing) { fillForm(existing); $("#delete").classList.remove("hidden"); }
    else if (param("date")) form.elements.date.value = param("date");

    const draft = loadDraft();
    if (draft && JSON.stringify(draft.data) !== JSON.stringify(readForm())) {
      fillForm(draft.data);
      $("#draft-note").innerHTML = `<div class="alert alert--info">${icon("info")}<div>Restored your unsaved draft from ${esc(new Date(draft.at).toLocaleString())}.
        <button class="btn btn--sm btn--plain" type="button" id="discard">Discard draft</button></div></div>`;
      $("#discard").onclick = () => { clearDraft(); location.reload(); };
    }

    form.addEventListener("input", () => { saveDraft(); updateRules(); });
    form.addEventListener("change", () => { saveDraft(); updateRules(); });
    form.addEventListener("submit", onSubmit);
    $("#delete").onclick = onDelete;
    $("#download-json").onclick = () => {
      const rec = { ...(existing || {}), ...readForm() };
      rec.id = rec.id || (rec.date || "undated") + "-" + slugify(rec.title || "event");
      download(rec.id + ".json", JSON.stringify(rec, null, 2), "application/json");
    };
    updateRules();
  });
})();
