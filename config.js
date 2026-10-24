/*
 * ============================================================================
 *  CLUB CONFIG — the one file most officers will ever need to edit.
 * ============================================================================
 *
 *  Everything that might change from year to year lives here:
 *    1. Club name / defaults
 *    2. Google sign-in + spreadsheet IDs (where the data lives)
 *    3. MSU catering rules (First Right of Refusal)
 *    4. The FRoR email template text
 *    5. Semester dates for the semester plan
 *
 *  This file is public (it's in a public GitHub repo). Nothing here is a
 *  secret: a Google OAuth *client ID* and a spreadsheet ID are safe to
 *  publish. The spreadsheet itself stays private — only Google accounts it
 *  has been shared with can read or write it.
 */
window.CONFIG = {
  /* ------------------------------------------------------------------------
   * 1. CLUB
   * ---------------------------------------------------------------------- */
  club: {
    name: "Hacker Cats",
    university: "Montana State University",
    // All event times are interpreted in this time zone (calendar exports).
    timeZone: "America/Denver",
  },

  /* ------------------------------------------------------------------------
   * 2. GOOGLE (data storage)
   *
   *  clientId:      OAuth 2.0 "Web application" client ID from Google Cloud
   *                 Console. See README → "Google setup". Leave "" to run in
   *                 DEMO MODE (data is kept only in your browser).
   *  spreadsheetId: The long ID in the Sheet URL:
   *                 https://docs.google.com/spreadsheets/d/<THIS PART>/edit
   *                 The Setup page can create this sheet for you.
   *  calendarEmbedId: Optional. A public Google Calendar ID to show as an
   *                 extra tab on the calendar page. Leave "" to hide.
   * ---------------------------------------------------------------------- */
  google: {
    clientId: "",
    spreadsheetId: "",
    calendarEmbedId: "",
  },

  /* ------------------------------------------------------------------------
   * 3. MSU CATERING RULES — "First Right of Refusal" (FRoR)
   *
   *  MSU University Catering is the exclusive caterer on campus. For groups
   *  under `attendanceLimit` people, email `email` to request a first right
   *  of refusal; if Catering declines, you may order from a local vendor.
   *  Update these if MSU's policy changes.
   * ---------------------------------------------------------------------- */
  catering: {
    email: "msucatering@montana.edu",
    // At or above this headcount, University Catering must cater the event.
    attendanceLimit: 25,
    // Vendors that skip the FRoR step. Matched case-insensitively against
    // the vendor name, ignoring spaces/punctuation ("Firehouse" matches
    // "Firehouse Subs", "firehouse subs - main st", etc.).
    exemptVendors: ["Firehouse"],
    // Buildings with their own outside-food rules. Matched case-insensitively
    // as whole words against the building field.
    specialBuildings: [
      {
        match: ["SUB", "Strand Union", "Strand Union Building"],
        warning:
          "The Strand Union Building (SUB) has its own outside-food rules. " +
          "In addition to the FRoR email, contact SUB Conference Services " +
          "before ordering food.",
      },
    ],
    // Shown on the email page. Catering likely isn't staffed on weekends.
    sendReminder:
      "Send this early in the week (Mon–Wed). University Catering likely " +
      "isn't staffed on weekends, and you'll want their reply before you " +
      "order from a vendor.",
  },

  /* ------------------------------------------------------------------------
   * 4. FRoR EMAIL TEMPLATE
   *
   *  Placeholders in {{double braces}} are filled from the event:
   *    {{club}} {{title}} {{description}} {{date}} {{dateShort}}
   *    {{startTime}} {{endTime}} {{building}} {{room}} {{location}}
   *    {{attendance}} {{vendor}} {{organizerName}} {{organizerRole}}
   *    {{organizerPhone}} {{organizerEmail}}
   *  You can still edit the text by hand on the email page before sending.
   * ---------------------------------------------------------------------- */
  frorEmail: {
    subject: "First Right of Refusal Request – {{club}} – {{date}}",
    body: `Hello MSU University Catering,

I'm writing on behalf of {{club}} to request a first right of refusal for an upcoming event.

Event: {{title}}
Date: {{date}}
Time: {{startTime}} – {{endTime}}
Location: {{location}}
Expected attendance: {{attendance}}
Proposed outside vendor: {{vendor}}

If University Catering is unable to cater this event, we would like to order from {{vendor}}. Please let me know if you need any other information.

Thank you,
{{organizerName}}
{{organizerRole}}, {{club}}
{{organizerPhone}}
{{organizerEmail}}`,
  },

  /* ------------------------------------------------------------------------
   * 5. SEMESTER PLAN
   *
   *  ⚠ VERIFY these against the official MSU academic calendar each
   *  semester — the dates below are placeholders, not official dates.
   *  Recurring meetings are skipped automatically on `breaks` days.
   * ---------------------------------------------------------------------- */
  semesters: [
    {
      name: "Fall 2026",
      start: "2026-08-26",
      end: "2026-12-18",
      breaks: [
        { name: "Labor Day", start: "2026-09-07", end: "2026-09-07" },
        { name: "Thanksgiving break", start: "2026-11-25", end: "2026-11-27" },
        { name: "Finals week", start: "2026-12-14", end: "2026-12-18" },
      ],
    },
    {
      name: "Spring 2027",
      start: "2027-01-13",
      end: "2027-05-07",
      breaks: [
        { name: "MLK Day", start: "2027-01-18", end: "2027-01-18" },
        { name: "Presidents' Day", start: "2027-02-15", end: "2027-02-15" },
        { name: "Spring break", start: "2027-03-15", end: "2027-03-19" },
        { name: "Finals week", start: "2027-05-03", end: "2027-05-07" },
      ],
    },
  ],

  /* ------------------------------------------------------------------------
   * Building suggestions for the event form (you can still type anything).
   * ---------------------------------------------------------------------- */
  buildings: [
    "Strand Union Building (SUB)",
    "Norm Asbjornson Hall",
    "Barnard Hall",
    "Roberts Hall",
    "Cobleigh Hall",
    "Renne Library",
    "Reid Hall",
    "Wilson Hall",
    "Gaines Hall",
    "Leon Johnson Hall",
    "Jabs Hall",
  ],
};
