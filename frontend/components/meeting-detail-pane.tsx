"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NotesPanel } from "./notes-panel";

type MeetingDetailPaneProps = {
  meeting: any;
  onNotify?: (message: string) => void;
  onDelete?: () => void;
  onUpdate?: () => void;
};

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function highlightText(text: string, query: string) {
  const needle = query.trim();
  if (!needle) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerNeedle, cursor);
    if (index === -1) {
      parts.push(text.slice(cursor));
      break;
    }

    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }

    parts.push(<mark key={`${index}-${cursor}`}>{text.slice(index, index + needle.length)}</mark>);
    cursor = index + needle.length;
  }

  return parts.length ? parts : text;
}

export function MeetingDetailPane({ meeting, onNotify, onDelete, onUpdate }: MeetingDetailPaneProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [question, setQuestion] = useState("");
  
  // Q&A Chat History
  const [chatHistory, setChatHistory] = useState<Array<{ sender: "user" | "assistant"; text: string; time: string }>>([
    { sender: "assistant", text: "Hi! Ask me anything about this meeting's blockers, decisions, or tasks.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [isAsking, setIsAsking] = useState(false);

  // Soundbite cropping states
  const [soundbiteTitle, setSoundbiteTitle] = useState("");
  const [soundbiteStart, setSoundbiteStart] = useState(0);
  const [soundbiteEnd, setSoundbiteEnd] = useState(Math.min(30, meeting.duration_seconds));

  // Edit Title & Participants
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(meeting.title);
  const [isEditingPeople, setIsEditingPeople] = useState(false);
  const [editedPeople, setEditedPeople] = useState(meeting.participants.join(", "));

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lineId: number; lineText: string } | null>(null);

  // Comments State
  const [activeCommentLineId, setActiveCommentLineId] = useState<number | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const lineRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const transcriptLines = useMemo(() => {
    return meeting.transcript_lines || meeting.transcript || [];
  }, [meeting]);

  const durationSec = meeting.duration_seconds || 1800;

  // Reset values when switching meetings
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setSearchQuery("");
    setActiveMatchIndex(0);
    setQuestion("");
    setChatHistory([
      { sender: "assistant", text: "Hi! Ask me anything about this meeting's blockers, decisions, or tasks.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setSoundbiteTitle("");
    setSoundbiteStart(0);
    setSoundbiteEnd(Math.min(30, durationSec));
    setEditedTitle(meeting.title);
    setEditedPeople(meeting.participants.join(", "));
    setIsEditingTitle(false);
    setIsEditingPeople(false);
  }, [meeting.id]);

  // Audio Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setCurrentTime((value) => {
        const nextValue = Math.min(durationSec, value + 1);
        if (nextValue >= durationSec) {
          setIsPlaying(false);
        }
        return nextValue;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, durationSec]);

  // Keyboard shortcut Space to Play/Pause
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        togglePlayback();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isPlaying, currentTime]);

  // Canvas waveform visualizer animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const barCount = 100;
      const barWidth = width / barCount - 2;

      // Draw standard bars
      for (let i = 0; i < barCount; i++) {
        // Generate pseudo-random audio bar height
        const factor = Math.sin(i * 0.15) * Math.cos(i * 0.05);
        let barHeight = Math.abs(factor) * (height - 12) + 6;

        // If playing, introduce dynamic jitter to make it alive
        if (isPlaying) {
          barHeight += (Math.random() - 0.5) * 6;
          barHeight = Math.max(4, Math.min(height, barHeight));
        }

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        // Highlight bars before the current playback progress
        const currentProgressIndex = (currentTime / durationSec) * barCount;
        if (i < currentProgressIndex) {
          ctx.fillStyle = "#6938ef"; // Active brand color
        } else {
          ctx.fillStyle = document.documentElement.getAttribute("data-theme") === "dark" ? "#24293f" : "#eaecf0"; // Line color
        }

        // Draw rounded rectangle bars
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, currentTime, durationSec]);

  // Find active line speaker sync
  const activeLine = useMemo(() => {
    const ordered = [...transcriptLines].sort((left, right) => left.start_second - right.start_second);
    if (ordered.length === 0) return null;

    let candidate = ordered[0];
    for (const line of ordered) {
      if (line.start_second <= currentTime) {
        candidate = line;
      } else {
        break;
      }
    }
    return candidate;
  }, [currentTime, transcriptLines]);

  // Scroll active line into view smoothly
  useEffect(() => {
    if (!activeLine) return;
    lineRefs.current[activeLine.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine?.id]);

  // Search matches memo
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return transcriptLines.filter((line: any) =>
      line.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      line.speaker_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transcriptLines, searchQuery]);

  // Navigate between search matches
  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % searchMatches.length;
    setActiveMatchIndex(nextIdx);
    const targetLine = searchMatches[nextIdx];
    seekTo(targetLine.start_second);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveMatchIndex(prevIdx);
    const targetLine = searchMatches[prevIdx];
    seekTo(targetLine.start_second);
  };

  const seekTo = (second: number) => {
    setCurrentTime(Math.max(0, Math.min(durationSec, second)));
  };

  const togglePlayback = () => {
    if (currentTime >= durationSec) {
      setCurrentTime(0);
    }
    setIsPlaying((value) => !value);
  };

  // Title and Participant updates
  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) return;
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editedTitle.trim() }),
      });
      if (res.ok) {
        setIsEditingTitle(false);
        onNotify?.("Meeting title updated successfully");
        onUpdate?.();
      }
    } catch (err) {
      onNotify?.("Failed to update title");
    }
  };

  const handleSavePeople = async () => {
    const list = editedPeople.split(",").map((p: string) => p.trim()).filter(Boolean);
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: list }),
      });
      if (res.ok) {
        setIsEditingPeople(false);
        onNotify?.("Participants list updated successfully");
        onUpdate?.();
      }
    } catch (err) {
      onNotify?.("Failed to update participants");
    }
  };

  // Highlights Toggle
  const handleToggleHighlight = async (lineId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meeting.id}/highlights/toggle?transcript_line_id=${lineId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        onNotify?.(data.highlighted ? "Line highlighted" : "Highlight removed");
        onUpdate?.();
      }
    } catch (err) {
      onNotify?.("Failed to toggle highlight");
    }
  };

  // Comments CRUD
  const handleAddComment = async (lineId: number) => {
    if (!newCommentText.trim()) return;
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meeting.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_line_id: lineId,
          commenter_name: "Default User",
          text: newCommentText.trim(),
        }),
      });
      if (res.ok) {
        setNewCommentText("");
        setActiveCommentLineId(null);
        onNotify?.("Comment added successfully");
        onUpdate?.();
      }
    } catch (err) {
      onNotify?.("Failed to add comment");
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editingCommentText.trim()) return;
    try {
      const res = await fetch(`http://localhost:8000/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingCommentText.trim() }),
      });
      if (res.ok) {
        setEditingCommentId(null);
        setEditingCommentText("");
        onNotify?.("Comment updated");
        onUpdate?.();
      }
    } catch (err) {
      onNotify?.("Failed to update comment");
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/comments/${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onNotify?.("Comment deleted");
        onUpdate?.();
      }
    } catch (err) {
      onNotify?.("Failed to delete comment");
    }
  };

  // Soundbites CRUD
  const handleSaveSoundbite = async () => {
    if (!soundbiteTitle.trim()) {
      onNotify?.("Please enter a soundbite title");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meeting.id}/soundbites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: soundbiteTitle.trim(),
          start_second: soundbiteStart,
          end_second: soundbiteEnd,
        }),
      });
      if (res.ok) {
        setSoundbiteTitle("");
        onNotify?.("Soundbite cropped and saved!");
        onUpdate?.();
      }
    } catch (err) {
      onNotify?.("Failed to save soundbite");
    }
  };

  const handleDeleteSoundbite = async (soundbiteId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/soundbites/${soundbiteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onNotify?.("Soundbite deleted");
        onUpdate?.();
      }
    } catch (err) {
      onNotify?.("Failed to delete soundbite");
    }
  };

  // AI Assistant Chat Submit
  const handleAskAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMsg = question.trim();
    setQuestion("");
    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatHistory(prev => [...prev, { sender: "user", text: userMsg, time: userTime }]);
    setIsAsking(true);

    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meeting.id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMsg }),
      });
      if (!res.ok) throw new Error("Assistant request failed");
      const data = await res.json();
      
      const assistantTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatHistory(prev => [...prev, { sender: "assistant", text: data.answer, time: assistantTime }]);
    } catch (err) {
      const assistantTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatHistory(prev => [...prev, { sender: "assistant", text: "Sorry, I had trouble answering that. Please try again.", time: assistantTime }]);
    } finally {
      setIsAsking(false);
    }
  };

  // Right click handler for Custom Context Menu
  const handleContextMenu = (e: React.MouseEvent, lineId: number, lineText: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      lineId,
      lineText,
    });
  };

  useEffect(() => {
    const closeContext = () => setContextMenu(null);
    window.addEventListener("click", closeContext);
    return () => window.removeEventListener("click", closeContext);
  }, []);

  const handleCopyLink = (second: number) => {
    const link = `${window.location.origin}/?meeting=${meeting.id}&t=${second}`;
    navigator.clipboard.writeText(link);
    onNotify?.("Link to timestamp copied to clipboard!");
  };

  // Delete Meeting endpoint
  const handleDeleteMeeting = async () => {
    if (!confirm("Are you sure you want to permanently delete this meeting?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/meetings/${meeting.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onNotify?.("Meeting deleted successfully");
        onDelete?.();
      }
    } catch (err) {
      onNotify?.("Failed to delete meeting");
    }
  };

  const exportMeeting = (format: "markdown" | "text") => {
    const transcript = transcriptLines.map((line: any) => `[${formatTime(line.start_second)}] ${line.speaker_name}: ${line.text}`).join("\n");
    const tasks = (meeting.action_items || []).map((item: any) => `- [${item.is_completed ? "x" : " "}] ${item.title}${item.assignee_name ? ` (${item.assignee_name})` : ""}`).join("\n");
    
    const content =
      format === "markdown"
        ? `# ${meeting.title}\n\n## Summary\n${meeting.summary_text}\n\n## Action Items\n${tasks}\n\n## Transcript\n${transcript}\n`
        : `${meeting.title}\n\nSummary\n${meeting.summary_text}\n\nAction Items\n${tasks}\n\nTranscript\n${transcript}\n`;
    const blob = new Blob([content], { type: format === "markdown" ? "text/markdown" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format === "markdown" ? "md" : "txt"}`;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotify?.(`Exported ${format === "markdown" ? "Markdown" : "TXT"} notes`);
  };

  const highlightedLineIds = useMemo(() => {
    return (meeting.highlights || []).map((h: any) => h.transcript_line_id);
  }, [meeting.highlights]);

  return (
    <section className="detail-panel meeting-detail">
      {/* HEADER SECTION */}
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <p className="eyebrow">Selected meeting</p>
          
          {isEditingTitle ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                style={{ fontSize: "1.5rem", fontWeight: 700, padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)", color: "var(--text-strong)", outline: "none" }}
              />
              <button className="primary-button" onClick={handleSaveTitle} style={{ padding: "6px 12px" }}>Save</button>
              <button className="ghost-button" onClick={() => { setIsEditingTitle(false); setEditedTitle(meeting.title); }}>Cancel</button>
            </div>
          ) : (
            <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>{meeting.title}</span>
              <button
                onClick={() => setIsEditingTitle(true)}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.9rem" }}
              >
                ✏️
              </button>
            </h1>
          )}

          <p className="muted" style={{ marginTop: "4px" }}>
            {meeting.meeting_date} · {meeting.source_filename || "Uploaded File"}
          </p>
        </div>
        
        <div className="detail-actions" style={{ display: "flex", gap: "8px" }}>
          <button className="ghost-button" type="button" onClick={() => window.print()}>
            Print PDF
          </button>
          <button className="ghost-button" type="button" onClick={() => exportMeeting("markdown")}>
            Export MD
          </button>
          <button className="ghost-button" type="button" onClick={() => exportMeeting("text")}>
            Export TXT
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={handleDeleteMeeting}
            style={{ color: "#d92d20", borderColor: "#fda29b" }}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="detail-meta-row" style={{ display: "flex", gap: "32px", padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
        <div style={{ flex: 1 }}>
          <span className="meta-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--muted)" }}>
            Participants
          </span>
          {isEditingPeople ? (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
              <input
                type="text"
                value={editedPeople}
                onChange={(e) => setEditedPeople(e.target.value)}
                style={{ width: "100%", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)", color: "var(--text-strong)", outline: "none", fontSize: "0.9rem" }}
              />
              <button className="primary-button" onClick={handleSavePeople} style={{ padding: "4px 10px", fontSize: "0.8rem" }}>Save</button>
              <button className="ghost-button" onClick={() => { setIsEditingPeople(false); setEditedPeople(meeting.participants.join(", ")); }} style={{ padding: "4px 10px", fontSize: "0.8rem" }}>Cancel</button>
            </div>
          ) : (
            <p style={{ display: "flex", alignItems: "center", gap: "6px", margin: "4px 0 0 0" }}>
              <span>{meeting.participants.join(", ")}</span>
              <button
                onClick={() => setIsEditingPeople(true)}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.75rem" }}
              >
                ✏️
              </button>
            </p>
          )}
        </div>
        <div>
          <span className="meta-label" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--muted)" }}>
            File Format
          </span>
          <p style={{ margin: "4px 0 0 0", fontWeight: 500 }}>{meeting.source_type || "manual"}</p>
        </div>
      </div>

      {/* AUDIO PLAYER & WAVEFORM VISUALIZATION */}
      <div className="player-shell" style={{ margin: "20px 0" }}>
        <div className="player-meta" style={{ width: "100%" }}>
          <div className="player-topline" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <strong>{activeLine ? activeLine.speaker_name : "Speaker sync ready"}</strong>
              <p style={{ margin: "4px 0 0 0", color: "var(--text)", fontSize: "0.9rem" }}>
                {activeLine ? activeLine.text : "Click play or select a transcript line."}
              </p>
            </div>
            <div className="time-readout" style={{ fontWeight: 600, fontSize: "0.95rem" }}>
              {formatTime(currentTime)} / {formatTime(durationSec)}
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <canvas ref={canvasRef} className="audio-waveform-canvas" width={600} height={48} />
          </div>

          <div className="player-controls" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button className="primary-button" type="button" onClick={togglePlayback}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <div className="seek-shell" style={{ flex: 1 }}>
              <input
                aria-label="Seek meeting playback"
                className="seek-range"
                max={durationSec}
                min={0}
                step={1}
                type="range"
                value={currentTime}
                onChange={(event) => seekTo(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SOUNDBITE CROPPER PANEL */}
      <div style={{ padding: "16px", background: "var(--surface-soft)", borderRadius: "10px", border: "1px solid var(--line)", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "0.95rem", margin: "0 0 8px 0" }}>✂️ Crop Soundbite</h3>
        <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 12px 0" }}>Create a short audio clip of key meeting discussions.</p>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", flex: 1, fontSize: "0.8rem" }}>
              <span>Start Second</span>
              <input
                type="number"
                min={0}
                max={durationSec}
                value={soundbiteStart}
                onChange={(e) => setSoundbiteStart(Math.max(0, Math.min(durationSec, Number(e.target.value))))}
                style={{ padding: "6px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", flex: 1, fontSize: "0.8rem" }}>
              <span>End Second</span>
              <input
                type="number"
                min={0}
                max={durationSec}
                value={soundbiteEnd}
                onChange={(e) => setSoundbiteEnd(Math.max(0, Math.min(durationSec, Number(e.target.value))))}
                style={{ padding: "6px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)" }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <input
              type="text"
              placeholder="Soundbite title (e.g. Project blocker discussion)"
              value={soundbiteTitle}
              onChange={(e) => setSoundbiteTitle(e.target.value)}
              style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text-strong)", fontSize: "0.85rem" }}
            />
            <button className="primary-button" type="button" onClick={handleSaveSoundbite} style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
              Save Clip
            </button>
          </div>
        </div>

        {/* Saved Soundbites list */}
        {meeting.soundbites && meeting.soundbites.length > 0 && (
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
            <h4 style={{ fontSize: "0.85rem", margin: "0 0 8px 0" }}>Saved Audio Clips:</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {meeting.soundbites.map((clip: any) => (
                <div key={clip.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "0.85rem" }}>
                  <button
                    type="button"
                    onClick={() => { seekTo(clip.start_second); setIsPlaying(true); }}
                    style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 600, cursor: "pointer", display: "flex", gap: "4px" }}
                  >
                    <span>▶️</span>
                    <span>{clip.title} ({clip.start_second}s - {clip.end_second}s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSoundbite(clip.id)}
                    style={{ background: "none", border: "none", color: "#d92d20", cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DETAIL GRID */}
      <div className="detail-grid">
        <div className="transcript-panel">
          <div className="transcript-head">
            <div>
              <h2>Interactive transcript</h2>
              <p className="muted">Right-click a line to open actions</p>
            </div>
            
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <label className="transcript-search" style={{ margin: 0 }}>
                <span>Search transcript</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setActiveMatchIndex(0);
                  }}
                  placeholder="Search transcript lines..."
                />
              </label>

              {searchMatches.length > 0 && (
                <div className="search-match-nav">
                  <span>{activeMatchIndex + 1} of {searchMatches.length}</span>
                  <button className="search-match-btn" type="button" onClick={handlePrevMatch}>▲</button>
                  <button className="search-match-btn" type="button" onClick={handleNextMatch}>▼</button>
                </div>
              )}
            </div>
          </div>

          <div className="transcript-list">
            {transcriptLines.map((line: any) => {
              const isActive = activeLine?.id === line.id;
              const isMatch = searchQuery && (
                line.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                line.speaker_name.toLowerCase().includes(searchQuery.toLowerCase())
              );
              const isSavedHighlight = highlightedLineIds.includes(line.id);

              // Filter line comments
              const lineComments = (meeting.comments || []).filter((c: any) => c.transcript_line_id === line.id);

              return (
                <div key={line.id} style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                  <button
                    ref={(element) => {
                      lineRefs.current[line.id] = element;
                    }}
                    className={`transcript-button${isActive ? " active" : ""}${isSavedHighlight ? " saved" : ""}${searchQuery && !isMatch ? " dimmed" : ""}`}
                    type="button"
                    onClick={() => seekTo(line.start_second)}
                    onContextMenu={(e) => handleContextMenu(e, line.id, line.text)}
                    style={{ position: "relative" }}
                  >
                    <div className="transcript-line" style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                      <div className="transcript-line-head" style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="speaker">{line.speaker_name}</span>
                        <span className="timestamp">
                          {formatTime(line.start_second)}
                          <span
                            className="line-action"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleHighlight(line.id);
                            }}
                          >
                            {isSavedHighlight ? "★ Highlighted" : "Highlight"}
                          </span>
                          <span
                            className="line-action"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveCommentLineId(activeCommentLineId === line.id ? null : line.id);
                            }}
                            style={{ marginLeft: "8px" }}
                          >
                            Comment {lineComments.length > 0 ? `(${lineComments.length})` : ""}
                          </span>
                        </span>
                      </div>
                      <p className={isSavedHighlight ? "highlight-line" : ""}>
                        {highlightText(line.text, searchQuery)}
                      </p>
                    </div>
                  </button>

                  {/* COMMENTS ACCORDION PANEL */}
                  {(activeCommentLineId === line.id || lineComments.length > 0) && (
                    <div className="comments-panel-container" style={{ margin: "4px 16px 12px 16px" }}>
                      {lineComments.map((comment: any) => (
                        <div key={comment.id} className="comment-bubble">
                          <div className="comment-header">
                            <strong>{comment.commenter_name}</strong>
                            <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          {editingCommentId === comment.id ? (
                            <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                              <input
                                type="text"
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                style={{ flex: 1, padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}
                              />
                              <button className="primary-button" onClick={() => handleUpdateComment(comment.id)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Save</button>
                              <button className="ghost-button" onClick={() => setEditingCommentId(null)} style={{ padding: "4px 8px", fontSize: "0.8rem" }}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <p className="comment-text" style={{ margin: "2px 0" }}>{comment.text}</p>
                              <div className="comment-actions">
                                <span onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.text); }}>Edit</span>
                                <span onClick={() => handleDeleteComment(comment.id)} style={{ color: "#d92d20" }}>Delete</span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {activeCommentLineId === line.id && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                          <input
                            type="text"
                            placeholder="Add a comment..."
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text-strong)", fontSize: "0.85rem" }}
                          />
                          <button className="primary-button" onClick={() => handleAddComment(line.id)} style={{ padding: "6px 12px", fontSize: "0.85rem" }}>
                            Send
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <NotesPanel
          meeting={meeting}
          onUpdate={onUpdate || (() => {})}
          seekTo={seekTo}
        />
      </div>

      {/* AI ASSISTANT CHAT PANELS */}
      <section className="ask-panel" style={{ marginTop: "24px" }}>
        <div>
          <p className="eyebrow">Ask this meeting</p>
          <h2>AI Q&A Assistant</h2>
        </div>

        {/* Chat History View */}
        <div className="qa-chat-history">
          {chatHistory.map((msg, index) => (
            <div key={index} className={`chat-msg ${msg.sender}`}>
              <span style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "2px", opacity: 0.85 }}>
                {msg.sender === "user" ? "You" : "Assistant"}
              </span>
              <span>{msg.text}</span>
              <span className="chat-msg-time">{msg.time}</span>
            </div>
          ))}
          {isAsking && (
            <div className="chat-msg assistant" style={{ fontStyle: "italic", color: "var(--muted)" }}>
              Typing response...
            </div>
          )}
        </div>

        <form onSubmit={handleAskAssistant} className="ask-row" style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about deliverables, action items, or what Aman said..."
            style={{ flex: 1 }}
          />
          <button className="primary-button" type="submit" disabled={isAsking}>
            {isAsking ? "Asking..." : "Ask"}
          </button>
        </form>
      </section>

      {/* CUSTOM CONTEXT MENU */}
      {contextMenu && (
        <div
          className="custom-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.lineText);
              onNotify?.("Transcript line text copied!");
            }}
          >
            📋 Copy Text
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              const activeSec = transcriptLines.find((l: any) => l.id === contextMenu.lineId)?.start_second || 0;
              handleCopyLink(activeSec);
            }}
          >
            🔗 Copy Timestamp Link
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              handleToggleHighlight(contextMenu.lineId);
            }}
          >
            ⭐ Highlight / Unhighlight
          </button>
        </div>
      )}
    </section>
  );
}
