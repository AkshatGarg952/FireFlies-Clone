"use client";

import { useState } from "react";

type NotesPanelProps = {
  meeting: any;
  onUpdate: () => void;
  seekTo: (second: number) => void;
};

const parseTimeToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};

export function NotesPanel({ meeting, onUpdate, seekTo }: NotesPanelProps) {
  // Action Item creation states
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionAssignee, setNewActionAssignee] = useState("");
  
  // Key Decision creation state
  const [newDecision, setNewDecision] = useState("");

  // Tag creation state
  const [newTag, setNewTag] = useState("");

  const handleActionToggle = async (actionId: number, isCompleted: boolean) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/action-items/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: isCompleted }),
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to toggle action item status", err);
    }
  };

  const handleAddActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionTitle.trim()) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/meetings/${meeting.id}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newActionTitle.trim(),
          assignee_name: newActionAssignee.trim() || null,
          is_completed: false,
        }),
      });
      if (res.ok) {
        setNewActionTitle("");
        setNewActionAssignee("");
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to add action item", err);
    }
  };

  const handleDeleteActionItem = async (actionId: number) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/action-items/${actionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to delete action item", err);
    }
  };

  const handleAddDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDecision.trim()) return;

    const updatedDecisions = [...(meeting.key_decisions || []), newDecision.trim()];
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_decisions: updatedDecisions }),
      });
      if (res.ok) {
        setNewDecision("");
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to add key decision", err);
    }
  };

  const handleDeleteDecision = async (indexToDelete: number) => {
    const updatedDecisions = (meeting.key_decisions || []).filter((_: any, idx: number) => idx !== indexToDelete);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_decisions: updatedDecisions }),
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to delete key decision", err);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    const updatedTags = [...(meeting.tags || []), newTag.trim()];
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (res.ok) {
        setNewTag("");
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to add tag", err);
    }
  };

  const handleDeleteTag = async (tagToDelete: string) => {
    const updatedTags = (meeting.tags || []).filter((t: string) => t !== tagToDelete);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error("Failed to delete tag", err);
    }
  };

  const completedCount = (meeting.action_items || []).filter((item: any) => item.is_completed).length;

  return (
    <aside className="notes-panel">
      {/* SUMMARY */}
      <section className="notes-section">
        <div className="notes-section-head">
          <div>
            <p className="eyebrow">AI notes</p>
            <h2>Summary</h2>
          </div>
          <span className="status-pill">{meeting.source_type}</span>
        </div>
        <p className="summary-copy">{meeting.summary_text}</p>
        <div className="summary-bullets">
          {(meeting.summary_bullets || []).map((bullet: string) => (
            <div key={bullet} className="summary-bullet">
              <span />
              <p>{bullet}</p>
            </div>
          ))}
        </div>
      </section>

      {/* KEY DECISIONS */}
      <section className="notes-section">
        <div className="notes-section-head">
          <div>
            <p className="eyebrow">Highlights</p>
            <h2>Key Decisions</h2>
          </div>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {(meeting.key_decisions || []).map((decision: string, index: number) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                fontSize: "0.88rem",
              }}
            >
              <span>{decision}</span>
              <button
                type="button"
                onClick={() => handleDeleteDecision(index)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  padding: "0 4px",
                }}
              >
                &times;
              </button>
            </div>
          ))}
          {(meeting.key_decisions || []).length === 0 && (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No key decisions recorded yet.
            </p>
          )}
        </div>

        <form onSubmit={handleAddDecision} style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="Add key decision..."
            value={newDecision}
            onChange={(e) => setNewDecision(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              fontSize: "0.85rem",
              background: "var(--surface-soft)",
              color: "var(--text-strong)",
              outline: "none",
            }}
          />
          <button className="primary-button" type="submit" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
            Add
          </button>
        </form>
      </section>

      {/* ACTION ITEMS */}
      <section className="notes-section">
        <div className="notes-section-head">
          <div>
            <p className="eyebrow">Tasks</p>
            <h2>Action items</h2>
          </div>
          <span className="status-pill">
            {completedCount}/{(meeting.action_items || []).length}
          </span>
        </div>

        <div className="action-list" style={{ marginBottom: "12px" }}>
          {(meeting.action_items || []).map((item: any) => (
            <div
              key={item.id}
              className="action-row"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, cursor: "pointer" }}>
                <input
                  checked={item.is_completed}
                  type="checkbox"
                  onChange={(event) => handleActionToggle(item.id, event.target.checked)}
                />
                <span style={{ textDecoration: item.is_completed ? "line-through" : "none" }}>
                  <strong>{item.title}</strong>
                  {item.assignee_name ? <small style={{ marginLeft: "6px", color: "var(--brand)", fontWeight: 600 }}>@{item.assignee_name}</small> : null}
                </span>
              </label>
              <button
                type="button"
                onClick={() => handleDeleteActionItem(item.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  marginLeft: "8px",
                }}
              >
                Delete
              </button>
            </div>
          ))}
          {(meeting.action_items || []).length === 0 && (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No action items assigned.
            </p>
          )}
        </div>

        <form onSubmit={handleAddActionItem} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <input
            type="text"
            placeholder="Action item title..."
            value={newActionTitle}
            onChange={(e) => setNewActionTitle(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              fontSize: "0.85rem",
              background: "var(--surface-soft)",
              color: "var(--text-strong)",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder="Assignee (e.g. Rahul)"
              value={newActionAssignee}
              onChange={(e) => setNewActionAssignee(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                fontSize: "0.85rem",
                background: "var(--surface-soft)",
                color: "var(--text-strong)",
                outline: "none",
              }}
            />
            <button className="primary-button" type="submit" style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
              Assign
            </button>
          </div>
        </form>
      </section>

      {/* CHAPTERS & TAGS */}
      <section className="notes-section">
        <div className="notes-section-head">
          <div>
            <p className="eyebrow">Outline</p>
            <h2>Chapters</h2>
          </div>
        </div>
        <div className="chapter-list" style={{ marginBottom: "16px" }}>
          {(meeting.chapters || []).map((chapter: any) => (
            <button
              key={`${chapter.time}-${chapter.label}`}
              className="chapter-row"
              type="button"
              onClick={() => seekTo(parseTimeToSeconds(chapter.time))}
            >
              <span>{chapter.time}</span>
              <strong>{chapter.label}</strong>
            </button>
          ))}
          {(meeting.chapters || []).length === 0 && (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No chapters generated.
            </p>
          )}
        </div>

        <div className="notes-section-head" style={{ marginTop: "16px" }}>
          <div>
            <p className="eyebrow">Categorization</p>
            <h2>Tags</h2>
          </div>
        </div>
        <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
          {(meeting.tags || []).map((tag: string) => (
            <span
              key={tag}
              className="chip"
              onClick={() => handleDeleteTag(tag)}
              title="Click to remove tag"
              style={{ cursor: "pointer", background: "var(--brand-soft)", color: "var(--brand)", fontWeight: 600 }}
            >
              {tag} &times;
            </span>
          ))}
          {(meeting.tags || []).length === 0 && (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No tags. Add some tags below.
            </p>
          )}
        </div>

        <form onSubmit={handleAddTag} style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="New tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              fontSize: "0.85rem",
              background: "var(--surface-soft)",
              color: "var(--text-strong)",
              outline: "none",
            }}
          />
          <button className="primary-button" type="submit" style={{ padding: "4px 10px", fontSize: "0.8rem" }}>
            Add
          </button>
        </form>
      </section>
    </aside>
  );
}
