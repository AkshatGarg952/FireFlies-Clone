"use client";

import { useEffect, useState } from "react";

import type { MeetingPreview } from "../lib/types";

type NotesPanelProps = {
  meeting: MeetingPreview;
};

export function NotesPanel({ meeting }: NotesPanelProps) {
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCompletedItems(
      Object.fromEntries(meeting.actionItems.map((item) => [item.id, item.completed])),
    );
  }, [meeting.id, meeting.actionItems]);

  const completedCount = meeting.actionItems.filter((item) => completedItems[item.id]).length;

  return (
    <aside className="notes-panel">
      <section className="notes-section">
        <div className="notes-section-head">
          <div>
            <p className="eyebrow">AI notes</p>
            <h2>Summary</h2>
          </div>
          <span className="status-pill">Seeded</span>
        </div>
        <p className="summary-copy">{meeting.summary}</p>
        <div className="summary-bullets">
          {meeting.summaryBullets.map((bullet) => (
            <div key={bullet} className="summary-bullet">
              <span />
              <p>{bullet}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="notes-section">
        <div className="notes-section-head">
          <div>
            <p className="eyebrow">Tasks</p>
            <h2>Action items</h2>
          </div>
          <span className="status-pill">
            {completedCount}/{meeting.actionItems.length}
          </span>
        </div>
        <div className="action-list">
          {meeting.actionItems.map((item) => (
            <label key={item.id} className="action-row">
              <input
                checked={completedItems[item.id] ?? false}
                type="checkbox"
                onChange={(event) =>
                  setCompletedItems((current) => ({
                    ...current,
                    [item.id]: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>{item.title}</strong>
                {item.assignee ? <small>{item.assignee}</small> : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="notes-section">
        <div className="notes-section-head">
          <div>
            <p className="eyebrow">Outline</p>
            <h2>Chapters</h2>
          </div>
        </div>
        <div className="chapter-list">
          {meeting.chapters.map((chapter) => (
            <button key={`${chapter.time}-${chapter.label}`} className="chapter-row" type="button">
              <span>{chapter.time}</span>
              <strong>{chapter.label}</strong>
            </button>
          ))}
        </div>
        <div className="chip-row">
          {meeting.topics.map((topic) => (
            <span key={topic} className="chip">
              {topic}
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}
