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
    actionItems: ["Finalize landing page copy", "Confirm launch owner", "Review launch deck"],
    topics: ["Launch", "Timeline", "Marketing"],
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
    actionItems: ["Refine onboarding flow", "Collect customer feedback", "Ship updated prototype"],
    topics: ["Product", "UX", "Sprint"],
    transcript: [
      { id: "l1", speaker: "Aman", timestamp: "00:10", startSecond: 10, text: "We need to close the onboarding feedback loop." },
      { id: "l2", speaker: "Nisha", timestamp: "00:24", startSecond: 24, text: "The new layout is ready for review." },
      { id: "l3", speaker: "Karan", timestamp: "00:39", startSecond: 39, text: "Let's keep the next sprint narrow so we can ship." }
    ]
  }
];
