"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { MeetingPreview, TranscriptLine } from "../lib/types";
import { NotesPanel } from "./notes-panel";

type MeetingDetailPaneProps = {
  meeting: MeetingPreview;
  onNotify?: (message: string) => void;
};

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function matchesTranscript(line: TranscriptLine, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return line.text.toLowerCase().includes(needle) || line.speaker.toLowerCase().includes(needle);
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

export function MeetingDetailPane({ meeting, onNotify }: MeetingDetailPaneProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedLineIds, setHighlightedLineIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const lineRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setSearchQuery("");
    setHighlightedLineIds([]);
    setQuestion("");
  }, [meeting.id]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentTime((value) => {
        const nextValue = Math.min(meeting.durationSeconds, value + 1);
        if (nextValue >= meeting.durationSeconds) {
          setIsPlaying(false);
        }
        return nextValue;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, meeting.durationSeconds]);

  const activeLine = useMemo(() => {
    const ordered = [...meeting.transcript].sort((left, right) => left.startSecond - right.startSecond);
    if (ordered.length === 0) {
      return null;
    }

    let candidate = ordered[0];
    for (const line of ordered) {
      if (line.startSecond <= currentTime) {
        candidate = line;
      } else {
        break;
      }
    }

    return candidate;
  }, [currentTime, meeting.transcript]);

  useEffect(() => {
    if (!activeLine) {
      return;
    }

    lineRefs.current[activeLine.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine?.id]);

  const transcriptMatches = useMemo(
    () => meeting.transcript.filter((line) => matchesTranscript(line, searchQuery)).length,
    [meeting.transcript, searchQuery],
  );

  const seekTo = (second: number) => {
    setCurrentTime(Math.max(0, Math.min(meeting.durationSeconds, second)));
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (currentTime >= meeting.durationSeconds) {
      setCurrentTime(0);
    }
    setIsPlaying((value) => !value);
  };

  const exportMeeting = (format: "markdown" | "text") => {
    const transcript = meeting.transcript.map((line) => `${line.timestamp} ${line.speaker}: ${line.text}`).join("\n");
    const tasks = meeting.actionItems.map((item) => `- [${item.completed ? "x" : " "}] ${item.title}${item.assignee ? ` (${item.assignee})` : ""}`).join("\n");
    const content =
      format === "markdown"
        ? `# ${meeting.title}\n\n## Summary\n${meeting.summary}\n\n## Action Items\n${tasks}\n\n## Transcript\n${transcript}\n`
        : `${meeting.title}\n\nSummary\n${meeting.summary}\n\nAction Items\n${tasks}\n\nTranscript\n${transcript}\n`;
    const blob = new Blob([content], { type: format === "markdown" ? "text/markdown" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${format === "markdown" ? "md" : "txt"}`;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotify?.(`Exported ${format === "markdown" ? "Markdown" : "TXT"} notes`);
  };

  const toggleHighlight = (lineId: string) => {
    setHighlightedLineIds((current) => {
      if (current.includes(lineId)) {
        onNotify?.("Removed transcript highlight");
        return current.filter((id) => id !== lineId);
      }
      onNotify?.("Added transcript highlight");
      return [...current, lineId];
    });
  };

  return (
    <section className="detail-panel meeting-detail">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Selected meeting</p>
          <h1>{meeting.title}</h1>
          <p className="muted">
            {meeting.date} at {meeting.time} - {meeting.duration}
          </p>
        </div>
        <div className="detail-actions">
          <button className="ghost-button" type="button" onClick={() => onNotify?.("Share placeholder opened")}>
            Share
          </button>
          <button className="ghost-button" type="button" onClick={() => exportMeeting("markdown")}>
            Export MD
          </button>
          <button className="ghost-button" type="button" onClick={() => exportMeeting("text")}>
            Export TXT
          </button>
        </div>
      </div>

      <div className="detail-meta-row">
        <div>
          <span className="meta-label">Participants</span>
          <p>{meeting.participants.join(", ")}</p>
        </div>
        <div>
          <span className="meta-label">Topics</span>
          <p>{meeting.topics.join(", ")}</p>
        </div>
      </div>

      <div className="player-shell">
        <div className="player-art">
          <span>Recording</span>
        </div>
        <div className="player-meta">
          <div className="player-topline">
            <div>
              <strong>{activeLine ? activeLine.speaker : "Speaker sync ready"}</strong>
              <p>{activeLine ? activeLine.text : "Use the transcript to jump to a moment in the meeting."}</p>
            </div>
            <div className="time-readout">
              {formatTime(currentTime)} / {formatTime(meeting.durationSeconds)}
            </div>
          </div>

          <div className="player-controls">
            <button className="primary-button" type="button" onClick={togglePlayback}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <div className="seek-shell">
              <input
                aria-label="Seek meeting playback"
                className="seek-range"
                max={meeting.durationSeconds}
                min={0}
                step={1}
                type="range"
                value={currentTime}
                onChange={(event) => seekTo(Number(event.target.value))}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="transcript-panel">
          <div className="transcript-head">
            <div>
              <h2>Interactive transcript</h2>
              <p className="muted">{transcriptMatches} matching lines highlighted</p>
            </div>
            <label className="transcript-search">
              <span>Search transcript</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search within the transcript"
              />
            </label>
          </div>

          <div className="transcript-list">
            {meeting.transcript.map((line) => {
              const isActive = activeLine?.id === line.id;
              const isHighlighted = matchesTranscript(line, searchQuery);
              const isSavedHighlight = highlightedLineIds.includes(line.id);

              return (
                <button
                  key={line.id}
                  ref={(element) => {
                    lineRefs.current[line.id] = element;
                  }}
                  className={`transcript-button${isActive ? " active" : ""}${isSavedHighlight ? " saved" : ""}${searchQuery && !isHighlighted ? " dimmed" : ""}`}
                  type="button"
                  onClick={() => seekTo(line.startSecond)}
                >
                  <div className="transcript-line">
                    <div className="transcript-line-head">
                      <span className="speaker">{line.speaker}</span>
                      <span className="timestamp">
                        {line.timestamp}
                        <span
                          className="line-action"
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleHighlight(line.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              toggleHighlight(line.id);
                            }
                          }}
                        >
                          {isSavedHighlight ? "Saved" : "Highlight"}
                        </span>
                      </span>
                    </div>
                    <p>{highlightText(line.text, searchQuery)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <NotesPanel meeting={meeting} />
      </div>

      <section className="ask-panel">
        <div>
          <p className="eyebrow">Ask this meeting</p>
          <h2>Meeting Q&A</h2>
        </div>
        <div className="ask-row">
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about blockers, decisions, or owners"
          />
          <button
            className="primary-button"
            type="button"
            onClick={() => onNotify?.(question ? "Generated a seeded answer preview" : "Type a question first")}
          >
            Ask
          </button>
        </div>
        {question ? (
          <p className="seeded-answer">
            Based on the seeded notes, the most relevant answer is in the summary, action items, and highlighted transcript moments.
          </p>
        ) : null}
      </section>
    </section>
  );
}
