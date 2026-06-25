import type { MeetingPreview } from "../lib/types";

type MeetingCardProps = {
  meeting: MeetingPreview;
  active?: boolean;
};

export function MeetingCard({ meeting, active = false }: MeetingCardProps) {
  return (
    <article className={`meeting-card${active ? " active" : ""}`}>
      <h3>{meeting.title}</h3>
      <p className="meta">
        {meeting.date} - {meeting.duration}
      </p>
      <p>{meeting.participants.join(", ")}</p>
    </article>
  );
}
