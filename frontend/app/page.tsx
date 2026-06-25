import { meetings } from "../lib/mock-data";
import { AppShell } from "../components/app-shell";
import { MeetingCard } from "../components/meeting-card";

export default function HomePage() {
  const highlighted = meetings[0];

  return (
    <AppShell
      library={
        <div className="meeting-list">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} active={meeting.id === highlighted.id} />
          ))}
        </div>
      }
      detail={
        <section className="detail-panel">
          <div className="panel-header">
            <p className="eyebrow">Meeting detail</p>
            <h1>{highlighted.title}</h1>
            <p className="muted">
              {highlighted.date} at {highlighted.time} - {highlighted.duration}
            </p>
          </div>

          <div className="player-shell">
            <div className="player-art" />
            <div className="player-meta">
              <span>Speaker sync ready</span>
              <div className="seek-bar">
                <span />
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div className="transcript-panel">
              <h2>Transcript</h2>
              {highlighted.transcript.slice(0, 4).map((line) => (
                <div key={line.id} className="transcript-line">
                  <span className="speaker">{line.speaker}</span>
                  <span className="timestamp">{line.timestamp}</span>
                  <p>{line.text}</p>
                </div>
              ))}
            </div>

            <div className="summary-panel">
              <h2>Summary</h2>
              <p>{highlighted.summary}</p>

              <h3>Action items</h3>
              <ul>
                {highlighted.actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <h3>Topics</h3>
              <div className="chip-row">
                {highlighted.topics.map((topic) => (
                  <span key={topic} className="chip">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      }
    />
  );
}
