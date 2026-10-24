/*
 * Setup page: shows how the app is configured, creates or repairs the club
 * spreadsheet, and imports/exports JSON backups.
 */
(function () {
  "use strict";
  const { $, esc, icon, toast, download, today } = window.App;
  const content = $("#content");
  const g = CONFIG.google;

  const step = (n, title, body) => `
    <section class="card">
      <div class="card__bar"><span>Step ${n} · ${title}</span></div>
      <div class="card__body">${body}</div>
    </section>`;

  function render() {
    const demo = Store.mode === "demo";
    const sheetId = demo ? "" : Store.spreadsheetId();
    const local = !demo && sheetId && sheetId !== g.spreadsheetId;

    content.innerHTML = `
      <div class="alert alert--${demo ? "caution" : "ok"}">${icon(demo ? "warning" : "check")}<div>
        ${demo
          ? "<strong>Demo mode.</strong> <code>CONFIG.google.clientId</code> in <code>config.js</code> is empty, so data is stored only in this browser."
          : "<strong>Google Sheets mode.</strong> Data is stored in the club's Google Sheet."}
      </div></div>

      ${step(1, "Google OAuth client", `
        <p>Create a free OAuth client in Google Cloud Console (see README → <em>Google setup</em>). Add these <strong>Authorized JavaScript origins</strong>:</p>
        <pre>${esc(location.origin)}\nhttps://hacker-cats.github.io\nhttp://localhost:8000</pre>
        <p>Then paste the client ID into <code>config.js</code> → <code>google.clientId</code>.</p>
        <dl class="meta"><dt>Client ID</dt><dd class="mono">${g.clientId ? esc(g.clientId) : '<span class="chip chip--signal">not set</span>'}</dd></dl>`)}

      ${step(2, "Spreadsheet", demo ? `<p class="muted">Available after you set a client ID.</p>` : `
        <dl class="meta">
          <dt>In config.js</dt><dd class="mono">${g.spreadsheetId ? esc(g.spreadsheetId) : '<span class="chip chip--signal">not set</span>'}</dd>
          ${local ? `<dt>This browser</dt><dd class="mono">${esc(sheetId)} <span class="chip">local override</span></dd>` : ""}
        </dl>
        ${local ? `<div class="alert alert--caution">${icon("warning")}<div>This browser is using a spreadsheet that isn't in <code>config.js</code> yet. Paste <code>${esc(sheetId)}</code> into <code>config.js</code> → <code>google.spreadsheetId</code> and commit, so other officers use it too.</div></div>` : ""}
        <div id="sheet-actions"></div>`)}

      ${step(3, "Share with officers", `
        <p>Open the Sheet in Google Sheets → <strong>Share</strong> → add each officer's Google account as <strong>Editor</strong>. Only people it's shared with can see the data. If your OAuth app is in “Testing” mode, also add each officer as a <em>test user</em> in Google Cloud Console.</p>
        ${sheetId ? `<a class="btn btn--plain" target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit">${icon("file")} Open the Sheet</a>` : ""}`)}

      <section class="card">
        <div class="card__bar"><span>Backup &amp; import</span></div>
        <div class="card__body">
          <p>Export everything as JSON, or import a backup file (records with the same id are overwritten). You can move demo data into the Sheet this way.</p>
          <div class="row">
            <button class="btn btn--plain" id="export">${icon("download")} Export JSON</button>
            <label class="btn btn--plain">${icon("upload")} Import JSON<input type="file" id="import" accept="application/json,.json" hidden></label>
            ${demo ? `<button class="btn btn--danger" id="reset-demo">${icon("refresh")} Reset demo data</button>` : ""}
          </div>
        </div>
      </section>`;

    if (!demo) renderSheetActions();
    $("#export").onclick = () => App.withData($("#sheet-actions") || content, async () => {
      const [events, meetings] = await Promise.all([Store.list("events"), Store.list("meetings")]);
      download(`club-backup-${today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), events, meetings }, null, 2), "application/json");
      if (!demo) renderSheetActions();
    });
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
      el.innerHTML = `<button class="btn" id="si">${icon("key")} Sign in with Google</button>`;
      $("#si").onclick = async () => { try { await Store.signIn(); location.reload(); } catch (e) { toast(e.message, "danger"); } };
      return;
    }
    el.innerHTML = `
      <div class="row">
        <button class="btn" id="create">${icon("plus")} Create a new club spreadsheet</button>
        ${Store.spreadsheetId() ? `<button class="btn btn--plain" id="check">${icon("refresh")} Check / repair tabs &amp; headers</button>` : ""}
      </div>
      <div class="form-grid">
        <label class="field"><span>…or use an existing spreadsheet ID in this browser</span><input id="sheet-id" placeholder="1AbC…xyz"></label>
      </div>
      <div class="row">
        <button class="btn btn--sm btn--plain" id="use-id">Use this ID</button>
        <button class="btn btn--sm btn--plain" id="clear-id">Go back to the ID in config.js</button>
      </div>`;
    $("#create").onclick = async (e) => {
      e.currentTarget.disabled = true;
      try {
        await Store.createSpreadsheet(CONFIG.club.name + " — Club Admin");
        toast("Spreadsheet created");
        render();
      } catch (err) { toast(err.message, "danger"); e.currentTarget.disabled = false; }
    };
    const check = $("#check");
    if (check) check.onclick = async () => {
      try { await Store.ensureTabs(); toast("Sheet looks good: tabs and headers are in place"); }
      catch (err) { toast(err.message, "danger"); }
    };
    $("#use-id").onclick = () => {
      const v = $("#sheet-id").value.trim().replace(/^.*\/d\/([^/]+).*$/, "$1"); // accept a full URL too
      if (!v) return;
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
      toast(`Imported ${events.length + meetings.length} record(s)`);
    } catch (e) { toast(e instanceof Store.AuthError ? "Sign in first, then import again." : e.message, "danger"); }
  }

  render();
})();
