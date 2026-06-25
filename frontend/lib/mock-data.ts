import type { MeetingPreview } from "./types";

export const meetings: MeetingPreview[] = [
  {
    id: "m1",
    title: "Q2 Launch Review",
    date: "Jun 24, 2026",
    time: "10:30 AM",
    duration: "42 min",
    durationSeconds: 2520,
    participants: ["Aditi", "Rahul", "Meera"],
    summary: "The team aligned on launch readiness, timeline risks, and the final marketing checklist.",
    summaryBullets: [
      "Launch readiness is on track, with engineering work already complete.",
      "The final checklist and launch deck still need review before sign-off.",
      "Marketing copy will be updated and shared today."
    ],
    actionItems: [
      { id: "m1-a1", title: "Finalize landing page copy", assignee: "Meera", completed: false },
      { id: "m1-a2", title: "Confirm launch owner", assignee: "Aditi", completed: false },
      { id: "m1-a3", title: "Review launch deck", assignee: "Rahul", completed: true }
    ],
    topics: ["Launch", "Timeline", "Marketing"],
    chapters: [
      { label: "Launch readiness", time: "00:08" },
      { label: "Checklist blockers", time: "00:21" },
      { label: "Marketing follow-up", time: "00:34" },
      { label: "Ownership decision", time: "00:49" }
    ],
    transcript: [
      { id: "l1", speaker: "Aditi", timestamp: "00:08", startSecond: 8, text: "Let's review where we are on launch readiness." },
      { id: "l2", speaker: "Rahul", timestamp: "00:21", startSecond: 21, text: "Engineering is done, but we still need the final checklist." },
      { id: "l3", speaker: "Meera", timestamp: "00:34", startSecond: 34, text: "I will update the copy and share the final version today." },
      { id: "l4", speaker: "Aditi", timestamp: "00:49", startSecond: 49, text: "Good, let's lock the launch owner before end of day." },
      { id: "l5", speaker: "Rahul", timestamp: "01:05", startSecond: 65, text: "We also need to keep the media kit in sync." }
    ]
  },
  {
    id: "m2",
    title: "Weekly Product Sync",
    date: "Jun 23, 2026",
    time: "4:00 PM",
    duration: "31 min",
    durationSeconds: 1860,
    participants: ["Aman", "Nisha", "Karan"],
    summary: "Product and design aligned on the next sprint goals and the open UX cleanup items.",
    summaryBullets: [
      "The onboarding feedback loop is the main product priority.",
      "The updated UX layout is ready for team review.",
      "The next sprint should stay narrow so the prototype can ship."
    ],
    actionItems: [
      { id: "m2-a1", title: "Refine onboarding flow", assignee: "Nisha", completed: false },
      { id: "m2-a2", title: "Collect customer feedback", assignee: "Aman", completed: false },
      { id: "m2-a3", title: "Ship updated prototype", assignee: "Karan", completed: false }
    ],
    topics: ["Product", "UX", "Sprint"],
    chapters: [
      { label: "Onboarding feedback", time: "00:10" },
      { label: "Layout review", time: "00:24" },
      { label: "Sprint scope", time: "00:39" }
    ],
    transcript: [
      { id: "l1", speaker: "Aman", timestamp: "00:10", startSecond: 10, text: "We need to close the onboarding feedback loop." },
      { id: "l2", speaker: "Nisha", timestamp: "00:24", startSecond: 24, text: "The new layout is ready for review." },
      { id: "l3", speaker: "Karan", timestamp: "00:39", startSecond: 39, text: "Let's keep the next sprint narrow so we can ship." }
    ]
  }
];
