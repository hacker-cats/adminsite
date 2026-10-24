/*
 * Create / edit an event.
 *   event.html             -> new event
 *   event.html?id=<id>     -> edit an existing event
 *   event.html?date=<iso>  -> new event with the date pre-filled
 *
 * While you type, the form is saved as a draft in localStorage. The draft is
 * cleared once the event is saved to the spreadsheet. Validation runs on
 * submit (design kit rule), not on every keystroke.
 */
(function () {
  "use strict";
  const { $, $$, esc, icon, alert, param, slugify, cateringRules, toast, download, fmtDate } = window.App;
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

  /* ---------- validation ---------- */
  // Each rule: [field name, message, test(record) -> true when valid]
  const RULES = [
    ["title", "Enter a title.", (r) => !!r.title],
    ["date", "Choose a date.", (r) => !!r.date],
    ["startTime", "Enter a start time.", (r) => !!r.startTime],
    ["endTime", "Enter an end time.", (r) => !!r.endTime],
    ["building", "Enter a building.", (r) => !!r.building],
    ["attendance", "Enter the expected number of people.", (r) => Number(r.attendance) >= 1],
    ["vendor", "Enter the vendor, or choose No food.", (r) => !r.hasFood || !!r.vendor],
    ["organizerName", "Enter the organizer's name.", (r) => !!r.organizerName],
    ["organizerEmail", "Enter an email address, like you@montana.edu.", (r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.organizerEmail || "")],
  ];

  function setError(name, msg) {
    const input = form.elements[name];
    const note = $("#f-" + name + "-note");
    if (!input || !note) return;
    if (msg) {
      input.setAttribute("aria-invalid", "true");
      note.textContent = msg;
      note.className = "field__note field__note--error";
      note.hidden = false;
    } else {
      input.removeAttribute("aria-invalid");
      note.hidden = true;
    }
  }

  /** Returns true when valid; otherwise shows notes + a summary and focuses the first problem. */
  function validate(rec) {
    const failed = RULES.filter(([, , ok]) => !ok(rec));
    RULES.forEach(([name]) => setError(name, ""));
    failed.forEach(([name, msg]) => setError(name, msg));
    $("#error-summary").innerHTML = failed.length
      ? alert("danger", `Please fix ${failed.length} field${failed.length === 1 ? "" : "s"}`,
          failed.map(([name, msg]) => `<a href="#f-${name}">${esc(msg)}</a>`).join("<br>"))
      : "";
    if (failed.length) form.elements[failed[0][0]].focus();
    return !failed.length;
  }

  /* ---------- live catering hints ---------- */
  function updateRules() {
    const rec = readForm();
    $("#vendor-field").classList.toggle("hidden", !rec.hasFood);
    const r = cateringRules(rec);
    const out = [];
    if (r.exempt) out.push(alert("info", "No catering email needed", `${esc(rec.vendor)} orders are exempt from the first right of refusal.`));
    if (r.needsFror && !r.overLimit) out.push(alert("warning", "Catering email needed", "Outside vendors need a first right of refusal from University Catering before you order. You can write it right after saving."));
    if (r.overLimit) out.push(alert("danger", `${esc(rec.attendance)} people expected`, `For groups of ${CONFIG.catering.attendanceLimit} or more, University Catering must cater the event. An outside vendor isn't allowed.`));
    if (rec.hasFood) for (const w of r.buildingWarnings) out.push(alert("warning", "This building has its own food rules", esc(w)));
    $("#rules").innerHTML = out.join("");
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
      <section class="card" role="status" style="max-width: 760px">
        <h2>Saved “${esc(ev.title)}”</h2>
        <p>${esc(fmtDate(ev.date))}. Next steps:</p>
        <div class="row">
          ${r.needsFror
            ? `<a class="btn" href="fror.html${q}">${icon("mail", "onDark")} Write the catering email</a>
               <a class="btn btn--secondary" href="poster.html${q}">${icon("print")} Make the poster</a>`
            : `<a class="btn" href="poster.html${q}">${icon("print", "onDark")} Make the poster</a>`}
          <button class="btn btn--secondary" id="ics">${icon("calendar")} Download .ics</button>
          <a class="btn btn--ghost" target="_blank" rel="noopener" href="${esc(Cal.eventGoogleLink(ev))}">Add to Google Calendar<span class="sr-only"> (opens in a new tab)</span></a>
        </div>
        <p class="small"><a href="event.html${q}">Keep editing</a> · <a href="index.html">Back to the dashboard</a></p>
      </section>`;
    $("#ics").onclick = () => download(ev.id + ".ics", Cal.eventIcs(ev), "text/calendar");
    $("main").focus();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const rec = readForm();
    if (!validate(rec)) return;
    if (rec.endTime <= rec.startTime &&
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
        content.innerHTML = alert("danger", "Event not found", `No event has the id <code>${esc(editId)}</code>. <a href="index.html">Back to the dashboard</a>.`);
        return;
      }
      $("#page-title").textContent = "Edit event";
      document.title = "Edit event · hackercats club admin";
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
      $("#draft-note").innerHTML = alert("info", "Restored your unsaved draft",
        `From ${esc(new Date(draft.at).toLocaleString())}. <button class="btn btn--ghost btn--sm" type="button" id="discard">Discard draft</button>`);
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
