# >_ hackercats club admin

A small, free web app for organizing Hacker Cats events at Montana State University:

- **Dashboard**: upcoming and past events, each with a status checklist (poster made → FRoR email sent → approval received → food ordered).
- **Event form**: create and edit events. Unsaved work is kept as a draft in your browser.
- **Poster generator**: three templates, editable club name, colors, and logo. Exports PNG and print-ready letter-size PDF.
- **Catering email**: writes the MSU University Catering "First Right of Refusal" email and opens it in Outlook, Gmail, or your mail app. Nothing is ever sent automatically.
- **Calendar**: a month view of events, recurring meetings, and breaks, plus `.ics` downloads and Google Calendar links.
- **Semester plan**: a week-by-week view of the semester with recurring meetings, events, breaks, clashes, and to-dos.

It's plain HTML/CSS/JavaScript with no build step and no server. It's hosted on GitHub Pages, and the data lives in a **private Google Sheet** that officers sign into with their Google accounts.

Live site: **https://hacker-cats.github.io/adminsite/**

---

## How it fits together

```
GitHub Pages (public)             Google (private)
┌──────────────────────┐ sign in  ┌───────────────────────────┐
│ this repo: HTML/JS   │ ───────▶ │ Google account (OAuth)    │
│ config.js            │          └───────────────────────────┘
│                      │ Sheets   ┌───────────────────────────┐
│ runs in your browser │ ◀──────▶ │ "Hacker Cats — Club Admin"│
└──────────────────────┘   API    │   Events tab, Meetings tab│
                                  └───────────────────────────┘
```

- The repo is public, but it contains **no event data**. The Sheet is the source of truth.
- Only Google accounts the Sheet is **shared with** can read or write it.
- If `config.js` has no Google client ID, the app runs in **demo mode** and stores data only in your browser's localStorage (with sample events). That's handy for trying things out.

## Files

| Path | What it is |
| --- | --- |
| `config.js` | **Edit me.** Club name, Google IDs, MSU catering rules, the FRoR email template, semester and break dates, building list. |
| `index.html` / `js/dashboard.js` | Dashboard |
| `event.html` / `js/event-form.js` | Create/edit an event |
| `poster.html` / `js/poster.js` | Poster generator |
| `js/poster-templates.js` + `css/posters.css` | **Poster templates** |
| `fror.html` / `js/fror.js` | First Right of Refusal email |
| `calendar.html` / `js/calendar-page.js` | Month calendar and "add to calendar" |
| `plan.html` / `js/plan.js` | Semester plan and recurring meetings |
| `setup.html` / `js/setup.js` | Connect/create the Sheet, import/export backups |
| `js/store.js` | Data layer (Google Sheets or demo localStorage) |
| `js/calendar.js` | Recurrence, `.ics`, Google Calendar links, month grid |
| `js/common.js` | Shared helpers, nav, **catering rule checks** |
| `css/app.css`, `css/tokens/` | Styles, built on the Hacker Cats design kit tokens |

## Run it locally

Any static file server works. From the repo folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Opening `index.html` directly as a `file://` URL won't work with Google sign-in.)

## Deploy (GitHub Pages)

Already enabled for `hacker-cats/adminsite`: every push to `main` redeploys within a minute or two. To set it up on a new repo:
**Settings → Pages → Build and deployment → Source: "Deploy from a branch" → Branch: `main` / `(root)` → Save.**

> GitHub Pages on a free organization requires the repo to be **public**. That's fine here: the repo has code only, and the data stays in the private Sheet.

---

## Google setup (one time, ~10 minutes, free)

1. **Create a Google Cloud project.** Go to <https://console.cloud.google.com/>, then project picker → **New project** (e.g. "hackercats-admin"). Using a club-owned Google account is best, so it survives officer turnover.
2. **Enable the Sheets API.** Go to **APIs & Services → Library**, search **Google Sheets API**, and click **Enable**.
3. **Configure the consent screen.** Go to **APIs & Services → OAuth consent screen** (now called "Google Auth Platform"):
   - User type: **External**. App name: "Hacker Cats Club Admin". Add your email as the support/developer contact.
   - Scopes: you can leave these empty. The app asks for `https://www.googleapis.com/auth/spreadsheets` when you sign in.
   - **Audience / Test users:** leave the app in **Testing** and add the Google account of every officer who'll use it (up to 100). This avoids Google's app verification process. Users will see an "unverified app" notice the first time; click **Continue**.
4. **Create the OAuth client.** Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins:**
     - `https://hacker-cats.github.io`
     - `http://localhost:8000`
   - No redirect URIs needed. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
5. **Paste the client ID into `config.js`** under `google.clientId`, then commit and push.
6. **Create the spreadsheet.** Open the site → **setup** → **Sign in with Google** → **Create a new club spreadsheet**. Copy the ID it shows into `config.js` under `google.spreadsheetId`, then commit and push. (Or make a Sheet yourself, paste its ID in config, and click **Check / repair tabs & headers**.)
7. **Share the Sheet** with each officer's Google account as **Editor**.

The client ID and spreadsheet ID are **not secrets**. They're safe in a public repo. Access is controlled by who the Sheet is shared with and who's on the test-user list.

### The spreadsheet

Two tabs, each with a header row. Columns are matched **by header name**, so you can reorder them, add your own extra columns, or edit cells directly in Google Sheets.

- **Events:** `id, title, description, date, startTime, endTime, building, room, attendance, hasFood, vendor, organizerName, organizerRole, organizerPhone, organizerEmail, posterMade, frorSent, approvalReceived, foodOrdered, notes, updatedAt`
- **Meetings:** `id, title, weekday (0=Sun … 6=Sat), startTime, endTime, building, room, frequency (weekly|biweekly), firstDate, lastDate, skipDates, notes, updatedAt`

Dates are `YYYY-MM-DD` and times are 24-hour `HH:MM`. Checkboxes are `TRUE`/`FALSE`.

**Backups:** use **Backup (JSON)** on the dashboard, or setup → **Export JSON**. Setup → **Import JSON** loads a backup (or a single event `.json`) back in. Google Sheets also keeps its own version history (File → Version history).

---

## Common edits

### Add or edit an event
Use the **+ new event** page, or click **Edit** on any event card. You can also edit the row directly in the Google Sheet.

### Change the catering rules or email text
Everything is in **`config.js`**:
- `catering.email`: University Catering's address (`msucatering@montana.edu`)
- `catering.attendanceLimit`: the 25-person threshold. At or above this number, the app warns that University Catering must cater the event.
- `catering.exemptVendors`: vendors that skip the FRoR (currently Firehouse Subs). Matching is case-insensitive and ignores spaces and punctuation.
- `catering.specialBuildings`: building-specific warnings (currently the SUB → contact SUB Conference Services).
- `catering.sendReminder`: the "send early in the week" note.
- `frorEmail.subject` / `frorEmail.body`: the email template. Placeholders like `{{title}}` and `{{date}}` are listed in the comment above it. A line whose placeholders are all empty (e.g. no phone number) is left out automatically.

### Update semester dates and breaks
`config.js` → `semesters`. **The dates shipped here are placeholders.** Check them against the official MSU academic calendar each semester. Recurring meetings automatically skip any date inside a `breaks` range.

### Add a recurring meeting
Go to **semester plan** → *Recurring meetings*. Pick the day, time, room, first and last date, and weekly or every-other-week. Add one-off skips as comma-separated dates. Each meeting has an `.ics` download (which includes the skipped dates) and appears on the calendar.

### Add a poster template
1. In `js/poster-templates.js`, copy one of the objects in `POSTER_TEMPLATES` and give it a new `id` and `name`.
2. Edit its `render(d)` markup. The comment at the top of the file lists everything in `d`.
3. Add styles in `css/posters.css` under `.poster--<your id>`.
4. **Use hex colors only** (`#2F2114`), not `oklch()`, in poster styles. The PNG/PDF exporter (html2canvas) can't read newer color formats.

Posters are 816 × 1056 px, which is exactly US Letter at 96 px/inch.

### Change the look of the app
`css/app.css` builds on the design kit tokens in `css/tokens/` (copied from `../design-kit`). Brand rules: fields sink, buttons rise; sharp corners; green means state (done/live), never navigation.

### Show the club's Google Calendar
Set `google.calendarEmbedId` in `config.js` to a **public** Google Calendar ID. The calendar page will get a "Google Calendar" tab.

---

## Libraries

Loaded from cdnjs, pinned to exact versions with integrity hashes (poster page only):
- [html2canvas 1.4.1](https://html2canvas.hertzen.com/): renders the poster to an image
- [jsPDF 2.5.1](https://github.com/parallax/jsPDF): wraps the image in a letter-size PDF

Also: Google Identity Services (`accounts.google.com/gsi/client`, served by Google and not versioned) for sign-in, and IBM Plex fonts from Google Fonts.

## Privacy notes
- Organizer phone numbers and emails are stored in the private Sheet, not in the repo.
- Your Google access token is kept in `sessionStorage` (this tab only, about 1 hour) so you don't have to sign in on every page.
- Drafts (event form, email edits) and poster settings stay in your browser's localStorage.
