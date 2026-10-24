/*
 * Setup page: shows how the app is configured, creates or repairs the club
 * spreadsheet, and imports/exports JSON backups.
 */
(function () {
  "use strict";
  const { $, esc, icon, alert, badge, toast, download, today } = window.App;
  const content = $("#content");
  const g = CONFIG.google;

  // Numbered steps use the yellow marker (one of the few places yellow is allowed).
  const step = (n, title, body) => `
    <section class="card" aria-labelledby="step-${n}">
      <h2 id="step-${n}" style="font-size: var(--web-size-h3); display: flex; gap: 12px; align-items: center"><span class="step-num" aria-hidden="true">${n}</span>${title}</h2>
      ${body}
    </section>`;

  function render() {
    const demo = Store.mode === "demo";
    const sheetId = demo ? "" : Store.spreadsheetId();
    const local = !demo && sheetId && sheetId !== g.spreadsheetId;

    content.innerHTML = `
      ${demo
        ? alert("warning", "Demo mode", "<code>google.clientId</code> in <code>config.js</code> is empty, so data is stored only in this browser.")
        : alert("info", "Google Sheets mode", "Data is stored in the club's Google Sheet.")}

      <div class="stack" style="gap: 20px; max-width: 880px">
      ${step(1, "Google sign-in client", `
        <p>Create a free OAuth client in Google Cloud Console (README, “Google setup”). Add these <strong>authorized JavaScript origins</strong>:</p>
        <pre class="code">${esc(location.origin)}\nhttps://hacker-cats.github.io\nhttp://localhost:8000</pre>
        <p>Then paste the client ID into <code>config.js</code> under <code>google.clientId</code>.</p>
        <dl class="details"><dt>Client ID</dt><dd>${g.clientId ? `<code>${esc(g.clientId)}</code>` : badge("Not set", "signal")}</dd></dl>`)}

      ${step(2, "Spreadsheet", demo ? `<p class="muted">Available once a client ID is set.</p>` : `
        <dl class="details">
          <dt>In config.js</dt><dd>${g.spreadsheetId ? `<code>${esc(g.spreadsheetId)}</code>` : badge("Not set", "signal")}</dd>
          ${local ? `<dt>This browser</dt><dd><code>${esc(sheetId)}</code> ${badge("Local override")}</dd>` : ""}
        </dl>
        ${local ? alert("warning", "Only this browser uses this spreadsheet", `Paste <code>${esc(sheetId)}</code> into <code>config.js</code> under <code>google.spreadsheetId</code> and commit it, so other officers use it too.`) : ""}
        <div id="sheet-actions" class="stack"></div>`)}

      ${step(3, "Share with officers", `
        <p>In Google Sheets, select <strong>Share</strong> and add each officer's Google account as an <strong>Editor</strong>. Only people it's shared with can see the data. While the OAuth app is in Testing mode, also add each officer as a test user in Google Cloud Console.</p>
        ${sheetId ? `<div class="row"><a class="btn btn--secondary" target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit">${icon("file")} Open the Sheet<span class="sr-only"> (opens in a new tab)</span></a></div>` : ""}`)}

      <section class="card" aria-labelledby="backup-h">
        <h2 id="backup-h" style="font-size: var(--web-size-h3)">Backup and import</h2>
        <p>Export everything as JSON, or import a backup file. Records with the same id are overwritten. This is also how you move demo data into the Sheet.</p>
        <div class="row">
          <button class="btn btn--secondary" id="export">${icon("download")} Export JSON</button>
          <label class="btn btn--secondary">${icon("upload")} Import JSON<input type="file" id="import" accept="application/json,.json" class="sr-only"></label>
          ${demo ? `<button class="btn btn--ghost" id="reset-demo" style="color: var(--web-red-text)">Reset demo data</button>` : ""}
        </div>
      </section>
      </div>`;

    if (!demo) renderSheetActions();
    $("#export").onclick = async () => {
      try {
        const [events, meetings] = await Promise.all([Store.list("events"), Store.list("meetings")]);
        download(`club-backup-${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), events, meetings }, null, 2), "application/json");
      } catch (e) { toast(e instanceof Store.AuthError ? "Sign in first, then export again." : e.message, "danger"); }
    };
    $("#import").onchange = (e) => importFile(e.target.files[0]);
    if (demo) $("#reset-demo").onclick = () => {
      if (!confirm("Erase demo data in this browser and reload the sample events?")) return;
      Store.reset();
      location.reload();
    };
  }

  function renderSheetActions() {
    const el = $("#sheet-actions");
    if (!Store.isSignedIn()) {
      el.innerHTML = `<div class="row"><button class="btn" id="si">Sign in with Google</button></div>`;
      $("#si").onclick = async () => { try { await Store.signIn(); location.reload(); } catch (e) { toast(e.message, "danger"); } };
      return;
    }
    el.innerHTML = `
      <div class="row">
        <button class="btn" id="create">${icon("plus", "onDark")} Create a new club spreadsheet</button>
        ${Store.spreadsheetId() ? `<button class="btn btn--secondary" id="check">Check tabs and headers</button>` : ""}
      </div>
      <div class="field" style="max-width: 560px">
        <div class="field__top"><label for="sheet-id">Or use an existing spreadsheet in this browser</label><span class="field__hint">Optional</span></div>
        <input id="sheet-id" placeholder="Spreadsheet ID or URL" aria-describedby="sheet-id-note">
        <p class="field__note" id="sheet-id-note">Paste the ID or the whole URL. This only affects your browser.</p>
      </div>
      <div class="row">
        <button class="btn btn--secondary btn--sm" id="use-id">Use this spreadsheet</button>
        <button class="btn btn--ghost btn--sm" id="clear-id">Go back to the one in config.js</button>
      </div>`;
    $("#create").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await Store.createSpreadsheet(CONFIG.club.name + " club admin");
        toast("Spreadsheet created.");
        render();
      } catch (err) { toast(err.message, "danger"); btn.disabled = false; }
    };
    const check = $("#check");
    if (check) check.onclick = async () => {
      try { await Store.ensureTabs(); toast("The Sheet has every tab and column it needs."); }
      catch (err) { toast(err.message, "danger"); }
    };
    $("#use-id").onclick = () => {
      const v = $("#sheet-id").value.trim().replace(/^.*\/d\/([^/]+).*$/, "$1"); // accept a full URL too
      if (!v) { $("#sheet-id").setAttribute("aria-invalid", "true"); $("#sheet-id-note").textContent = "Paste a spreadsheet ID or URL first."; $("#sheet-id-note").className = "field__note field__note--error"; $("#sheet-id").focus(); return; }
      Store.setLocalSpreadsheetId(v);
      render();
    };
    $("#clear-id").onclick = () => { Store.setLocalSpreadsheetId(""); render(); };
  }

  async function importFile(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      // Accept a full backup ({events, meetings}) or a single event object.
      const events = data.events || (data.id && data.date ? [data] : []);
      const meetings = data.meetings || [];
      if (!events.length && !meetings.length) throw new Error("No events or meetings found in that file.");
      if (!confirm(`Import ${events.length} event(s) and ${meetings.length} meeting(s)?`)) return;
      for (const ev of events) await Store.save("events", ev);
      for (const m of meetings) await Store.save("meetings", m);
      toast(`Imported ${events.length + meetings.length} record(s).`);
    } catch (e) { toast(e instanceof Store.AuthError ? "Sign in first, then import again." : e.message, "danger"); }
  }

  render();
})();
