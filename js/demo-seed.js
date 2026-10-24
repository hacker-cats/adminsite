/*
 * Sample data used in DEMO MODE only (when CONFIG.google.clientId is empty).
 * It's loaded into your browser's localStorage the first time you open the
 * app. Use "Reset demo data" on the Setup page to start over.
 */
window.DEMO_SEED = {
  events: [
    {
      id: "2026-10-10-intro-to-ctf",
      title: "Intro to CTF",
      description: "A beginner-friendly walkthrough of capture-the-flag challenges.",
      date: "2026-10-10", startTime: "18:00", endTime: "20:00",
      building: "Barnard Hall", room: "108", attendance: 22,
      hasFood: true, vendor: "Firehouse Subs",
      organizerName: "Alex Example", organizerRole: "President",
      organizerPhone: "406-555-0100", organizerEmail: "alex.example@student.montana.edu",
      posterMade: true, frorSent: false, approvalReceived: false, foodOrdered: true,
    },
    {
      id: "2026-11-07-game-night",
      title: "Game Night",
      description: "Board games, retro consoles, and pizza. Bring a friend!",
      date: "2026-11-07", startTime: "18:00", endTime: "21:00",
      building: "Strand Union Building (SUB)", room: "235", attendance: 20,
      hasFood: true, vendor: "Pizza Campania",
      organizerName: "Alex Example", organizerRole: "President",
      organizerPhone: "406-555-0100", organizerEmail: "alex.example@student.montana.edu",
      posterMade: false, frorSent: false, approvalReceived: false, foodOrdered: false,
    },
    {
      id: "2026-11-18-industry-speaker",
      title: "Industry Speaker: Red Teaming",
      description: "A local security engineer talks about life on a red team.",
      date: "2026-11-18", startTime: "18:30", endTime: "20:00",
      building: "Norm Asbjornson Hall", room: "165", attendance: 40,
      hasFood: true, vendor: "Bagel Works",
      organizerName: "Sam Sample", organizerRole: "Events Officer",
      organizerPhone: "", organizerEmail: "sam.sample@student.montana.edu",
      posterMade: true, frorSent: false, approvalReceived: false, foodOrdered: false,
    },
  ],
  meetings: [
    {
      id: "weekly-meeting",
      title: "Weekly meeting",
      weekday: 2, startTime: "18:30", endTime: "20:00",
      building: "Barnard Hall", room: "108",
      frequency: "weekly", firstDate: "2026-09-01", lastDate: "2026-12-11",
      skipDates: "", notes: "Open to all members.",
    },
    {
      id: "officer-meeting",
      title: "Officer meeting",
      weekday: 4, startTime: "17:00", endTime: "17:45",
      building: "Renne Library", room: "Study room 2",
      frequency: "biweekly", firstDate: "2026-09-03", lastDate: "2026-12-10",
      skipDates: "2026-10-15", notes: "",
    },
  ],
};
