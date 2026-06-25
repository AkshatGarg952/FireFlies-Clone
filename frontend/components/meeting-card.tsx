import React from "react";

type MeetingCardProps = {
  meeting: {
    id: number;
    title: string;
    meeting_date: string;
    duration_seconds: number;
    participants: string[];
    tags?: string[];
  };
  active?: boolean;
};

const AVATAR_COLORS = [
  { bg: "#f4f3ff", color: "#6938ef" },
  { bg: "#ecfdf3", color: "#12b76a" },
  { bg: "#fff8f1", color: "#f79009" },
  { bg: "#fef3f2", color: "#f04438" },
  { bg: "#f0f9ff", color: "#0ba5ec" },
];

export function MeetingCard({ meeting, active = false }: MeetingCardProps) {
  const mins = Math.round(meeting.duration_seconds / 60);
  const durationStr = mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m`
    : mins > 0 ? `${mins}m` : "< 1m";

  const dateFormatted = meeting.meeting_date
    ? new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return (
    <article className={`meeting-card${active ? " active" : ""}`}>
      <h3 style={{ 
        display: "-webkit-box", 
        WebkitLineClamp: 2, 
        WebkitBoxOrient: "vertical", 
        overflow: "hidden" 
      }}>
        {meeting.title}
      </h3>

      <p className="meta" style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
        <span>{dateFormatted}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{durationStr}</span>
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Participant avatar stack */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {meeting.participants.slice(0, 4).map((name, i) => {
            const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            const palette = AVATAR_COLORS[i % AVATAR_COLORS.length];
            return (
              <div
                key={i}
                title={name}
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: palette.bg,
                  color: palette.color,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid var(--surface)",
                  marginLeft: i === 0 ? 0 : "-6px",
                  zIndex: 4 - i,
                  position: "relative",
                }}
              >
                {initials}
              </div>
            );
          })}
          {meeting.participants.length > 4 && (
            <div style={{
              width: "26px", height: "26px", borderRadius: "50%",
              background: "var(--line)", color: "var(--muted-strong)",
              fontSize: "0.6rem", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid var(--surface)", marginLeft: "-6px",
            }}>
              +{meeting.participants.length - 4}
            </div>
          )}
        </div>

        {/* Tags */}
        {meeting.tags && meeting.tags.length > 0 && (
          <span style={{
            fontSize: "0.68rem",
            background: "var(--brand-soft)",
            color: "var(--brand)",
            padding: "2px 7px",
            borderRadius: "4px",
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}>
            {meeting.tags[0]}
          </span>
        )}
      </div>
    </article>
  );
}
