/*
 * Data storage.
 *
 * Two interchangeable backends with the same async API:
 *
 *   SheetsStore — the real thing. Signs in with Google (OAuth token flow via
 *                 Google Identity Services) and reads/writes a private Google
 *                 Sheet through the Sheets REST API. Used when
 *                 CONFIG.google.clientId is set.
 *   DemoStore   — keeps everything in this browser's localStorage, seeded
 *                 with sample data. Used when no clientId is configured, so
 *                 the app works out of the box for local testing.
 *
 * The spreadsheet has one tab per "kind" of record. Row 1 is a header row;
 * each later row is one record. Columns are matched by header name, so you
 * can reorder columns or add your own extra columns in the Sheet freely.
 *
 * API (both stores):
 *   Store.mode                  "sheets" | "demo"
 *   Store.isSignedIn()          -> boolean
 *   Store.signIn()              -> Promise (opens Google popup; needs a click)
 *   Store.signOut()
 *   Store.list(kind)            -> Promise<object[]>   kind: "events" | "meetings"
 *   Store.get(kind, id)         -> Promise<object|null>
 *   Store.save(kind, record)    -> Promise<object>     insert or update by id
 *   Store.patch(kind, id, data) -> Promise<object>     update some fields
 *   Store.remove(kind, id)      -> Promise
 */
(function () {
  "use strict";

  // Column order used when creating a new sheet. Add a field here (and to
  // the form) to store something new; existing sheets get the new column
  // appended automatically on the next save.
  const SCHEMA = {
    events: {
      tab: "Events",
      fields: [
        "id", "title", "description", "date", "startTime", "endTime",
        "building", "room", "attendance",
        "hasFood", "vendor",
        "organizerName", "organizerRole", "organizerPhone", "organizerEmail",
        // status checklist
        "posterMade", "frorSent", "approvalReceived", "foodOrdered",
        "notes", "updatedAt",
      ],
      booleans: ["hasFood", "posterMade", "frorSent", "approvalReceived", "foodOrdered"],
      numbers: ["attendance"],
    },
    meetings: {
      tab: "Meetings",
      fields: [
        "id", "title", "weekday", "startTime", "endTime", "building", "room",
        "frequency", "firstDate", "lastDate", "skipDates", "notes", "updatedAt",
      ],
      booleans: [],
      numbers: ["weekday"],
    },
  };

  /** Normalize values coming back from the sheet (or localStorage). */
  function clean(kind, rec) {
    const s = SCHEMA[kind];
    const out = {};
    for (const f of s.fields) out[f] = rec[f] ?? "";
    for (const k of Object.keys(rec)) if (!(k in out) && !k.startsWith("_")) out[k] = rec[k];
    for (const b of s.booleans) out[b] = rec[b] === true || String(rec[b]).toUpperCase() === "TRUE";
    for (const n of s.numbers) out[n] = rec[n] === "" || rec[n] == null ? "" : Number(rec[n]);
    for (const f of ["date", "firstDate", "lastDate"]) if (f in out) out[f] = sheetDate(out[f]);
    for (const f of ["startTime", "endTime"]) if (f in out) out[f] = sheetTime(out[f]);
    return out;
  }

  // If someone types a date/time directly into the Sheet, Google stores it as
  // a serial number. Convert those back to "YYYY-MM-DD" / "HH:MM".
  function sheetDate(v) {
    if (typeof v !== "number") return String(v || "");
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  function sheetTime(v) {
    if (typeof v !== "number") return String(v || "");
    const mins = Math.round((v % 1) * 1440);
    return String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
  }

  function stamp(rec) {
    return { ...rec, updatedAt: new Date().toISOString() };
  }

  /* ======================================================================
   * DemoStore — localStorage
   * ==================================================================== */
  const DEMO_KEY = "hc-admin-demo-db";

  function demoLoad() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to seed */ }
    const db = window.DEMO_SEED ? JSON.parse(JSON.stringify(window.DEMO_SEED)) : { events: [], meetings: [] };
    demoWrite(db);
    return db;
  }
  function demoWrite(db) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) { console.warn("localStorage unavailable", e); }
  }

  const DemoStore = {
    mode: "demo",
    isSignedIn: () => true,
    signIn: async () => {},
    signOut: () => {},
    async list(kind) {
      return (demoLoad()[kind] || []).map((r) => clean(kind, r));
    },
    async get(kind, id) {
      return (await this.list(kind)).find((r) => r.id === id) || null;
    },
    async save(kind, rec) {
      const db = demoLoad();
      db[kind] = db[kind] || [];
      const next = stamp(clean(kind, rec));
      const i = db[kind].findIndex((r) => r.id === next.id);
      if (i >= 0) db[kind][i] = next; else db[kind].push(next);
      demoWrite(db);
      return next;
    },
    async patch(kind, id, data) {
      const cur = await this.get(kind, id);
      if (!cur) throw new Error("Record not found: " + id);
      return this.save(kind, { ...cur, ...data });
    },
    async remove(kind, id) {
      const db = demoLoad();
      db[kind] = (db[kind] || []).filter((r) => r.id !== id);
      demoWrite(db);
    },
    /** Wipe demo data and re-seed with the sample events. */
    reset() {
      try { localStorage.removeItem(DEMO_KEY); } catch (e) {}
    },
  };

  /* ======================================================================
   * SheetsStore — Google Sheets via OAuth
   * ==================================================================== */
  const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
  const TOKEN_KEY = "hc-admin-google-token";
  const SHEET_OVERRIDE_KEY = "hc-admin-spreadsheet-id";
  const API = "https://sheets.googleapis.com/v4/spreadsheets";

  class AuthError extends Error {}

  let gisLoading = null;
  function loadGis() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (!gisLoading) {
      gisLoading = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Couldn't load Google sign-in. Check your connection or ad blocker."));
        document.head.appendChild(s);
      });
    }
    return gisLoading;
  }

  // The access token lasts ~1 hour. We keep it in sessionStorage (this tab
  // only, cleared when the tab closes) so moving between pages doesn't ask
  // you to sign in again.
  function readToken() {
    try {
      const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
      if (t && t.expiresAt > Date.now() + 60000) return t.accessToken;
    } catch (e) {}
    return null;
  }
  function writeToken(accessToken, expiresIn) {
    try {
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken, expiresAt: Date.now() + expiresIn * 1000 }));
    } catch (e) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function spreadsheetId() {
    let override = "";
    try { override = localStorage.getItem(SHEET_OVERRIDE_KEY) || ""; } catch (e) {}
    return override || window.CONFIG.google.spreadsheetId || "";
  }

  async function api(url, opts = {}) {
    const token = readToken();
    if (!token) throw new AuthError("Not signed in");
    const res = await fetch(url, {
      ...opts,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 401) {
      clearToken();
      throw new AuthError("Your Google sign-in expired. Please sign in again.");
    }
    if (!res.ok) {
      let msg = res.status + " " + res.statusText;
      try { msg = (await res.json()).error.message || msg; } catch (e) {}
      if (res.status === 403 || res.status === 404) {
        msg += " — check that the spreadsheet ID in config.js is right and the Sheet is shared with your Google account (Editor).";
      }
      throw new Error("Google Sheets: " + msg);
    }
    return res.status === 204 ? null : res.json();
  }

  const sheetUrl = (path) => {
    const id = spreadsheetId();
    if (!id) throw new Error("No spreadsheet configured yet. Open the Setup page to create or connect one.");
    return API + "/" + encodeURIComponent(id) + path;
  };

  /** Read a whole tab: returns { headers, rows: [{...record, _row}] }. */
  async function readTab(kind) {
    const tab = SCHEMA[kind].tab;
    const data = await api(sheetUrl("/values/" + encodeURIComponent(tab) + "?valueRenderOption=UNFORMATTED_VALUE"));
    const values = data.values || [];
    const headers = (values[0] || []).map(String);
    const rows = values.slice(1).map((vals, i) => {
      const rec = { _row: i + 2 }; // sheet rows are 1-based and row 1 is headers
      headers.forEach((h, j) => { if (h) rec[h] = vals[j] ?? ""; });
      return rec;
    }).filter((r) => r.id);
    return { headers, rows };
  }

  /** Make sure the header row contains every schema field (append any missing). */
  async function ensureHeaders(kind, headers) {
    const missing = SCHEMA[kind].fields.filter((f) => !headers.includes(f));
    if (!missing.length) return headers;
    const next = headers.concat(missing);
    const tab = SCHEMA[kind].tab;
    await api(sheetUrl("/values/" + encodeURIComponent(tab + "!A1") + "?valueInputOption=RAW"), {
      method: "PUT",
      body: JSON.stringify({ values: [next] }),
    });
    return next;
  }

  async function tabIds() {
    const meta = await api(sheetUrl("?fields=sheets.properties"));
    const out = {};
    for (const s of meta.sheets) out[s.properties.title] = s.properties.sheetId;
    return out;
  }

  const SheetsStore = {
    mode: "sheets",
    AuthError,
    isSignedIn: () => !!readToken(),

    /** Opens the Google consent popup. Must be called from a click handler. */
    async signIn() {
      await loadGis();
      return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: window.CONFIG.google.clientId,
          scope: SCOPE,
          callback: (resp) => {
            if (resp.error) return reject(new Error(resp.error_description || resp.error));
            writeToken(resp.access_token, Number(resp.expires_in) || 3600);
            resolve();
          },
          error_callback: (err) => reject(new Error(err.message || err.type || "Sign-in cancelled")),
        });
        client.requestAccessToken({ prompt: "" });
      });
    },

    signOut() {
      const t = readToken();
      clearToken();
      if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {});
    },

    async list(kind) {
      const { rows } = await readTab(kind);
      return rows.map((r) => clean(kind, r));
    },

    async get(kind, id) {
      return (await this.list(kind)).find((r) => r.id === id) || null;
    },

    async save(kind, rec) {
      // Always re-read first so we update the right row even if someone
      // else added or deleted rows since this page loaded.
      const { headers: h0, rows } = await readTab(kind);
      const headers = await ensureHeaders(kind, h0);
      const next = stamp(clean(kind, rec));
      // JSON booleans/numbers/strings are stored as-is (RAW = no formula
      // parsing, so text like "=SUM()" can't run as a formula).
      const values = [headers.map((h) => (h in next ? next[h] : ""))];
      const existing = rows.find((r) => r.id === next.id);
      const tab = SCHEMA[kind].tab;
      if (existing) {
        await api(sheetUrl("/values/" + encodeURIComponent(tab + "!A" + existing._row) + "?valueInputOption=RAW"), {
          method: "PUT",
          body: JSON.stringify({ values }),
        });
      } else {
        await api(sheetUrl("/values/" + encodeURIComponent(tab + "!A1") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"), {
          method: "POST",
          body: JSON.stringify({ values }),
        });
      }
      return next;
    },

    async patch(kind, id, data) {
      const cur = await this.get(kind, id);
      if (!cur) throw new Error("Record not found: " + id);
      return this.save(kind, { ...cur, ...data });
    },

    async remove(kind, id) {
      const { rows } = await readTab(kind);
      const existing = rows.find((r) => r.id === id);
      if (!existing) return;
      const ids = await tabIds();
      await api(sheetUrl(":batchUpdate"), {
        method: "POST",
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: { sheetId: ids[SCHEMA[kind].tab], dimension: "ROWS", startIndex: existing._row - 1, endIndex: existing._row },
            },
          }],
        }),
      });
    },

    /* ---- setup helpers (used by setup.html) ---- */

    spreadsheetId,

    /** Use a different spreadsheet in this browser only (for testing). */
    setLocalSpreadsheetId(id) {
      try {
        if (id) localStorage.setItem(SHEET_OVERRIDE_KEY, id);
        else localStorage.removeItem(SHEET_OVERRIDE_KEY);
      } catch (e) {}
    },

    /** Create a brand-new spreadsheet with the right tabs + headers. */
    async createSpreadsheet(title) {
      const sheet = await api(API, {
        method: "POST",
        body: JSON.stringify({
          properties: { title },
          sheets: Object.values(SCHEMA).map((s) => ({
            properties: { title: s.tab, gridProperties: { frozenRowCount: 1 } },
          })),
        }),
      });
      this.setLocalSpreadsheetId(sheet.spreadsheetId);
      await this.ensureTabs();
      return sheet;
    },

    /** Add any missing tabs and header columns to the configured sheet. */
    async ensureTabs() {
      const ids = await tabIds();
      const missing = Object.values(SCHEMA).filter((s) => !(s.tab in ids));
      if (missing.length) {
        await api(sheetUrl(":batchUpdate"), {
          method: "POST",
          body: JSON.stringify({
            requests: missing.map((s) => ({ addSheet: { properties: { title: s.tab, gridProperties: { frozenRowCount: 1 } } } })),
          }),
        });
      }
      for (const kind of Object.keys(SCHEMA)) {
        const { headers } = await readTab(kind);
        await ensureHeaders(kind, headers);
      }
    },
  };

  window.SCHEMA = SCHEMA;
  window.Store = window.CONFIG.google.clientId ? SheetsStore : DemoStore;
  window.Store.AuthError = AuthError;
})();
