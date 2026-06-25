"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { MeetingPreview, TranscriptLine } from "../lib/types";

type MeetingDetailPaneProps = {
  meeting: MeetingPreview;
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

export function MeetingDetailPane({ meeting }: MeetingDetailPaneProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const lineRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setSearchQuery("");
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
          <button className="ghost-button" type="button">
            Share
          </button>
          <button className="ghost-button" type="button">
            Export
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

              return (
                <button
                  key={line.id}
                  ref={(element) => {
                    lineRefs.current[line.id] = element;
                  }}
                  className={`transcript-button${isActive ? " active" : ""}${searchQuery && !isHighlighted ? " dimmed" : ""}`}
                  type="button"
                  onClick={() => seekTo(line.startSecond)}
                >
                  <div className="transcript-line">
                    <div className="transcript-line-head">
                      <span className="speaker">{line.speaker}</span>
                      <span className="timestamp">{line.timestamp}</span>
                    </div>
                    <p>{highlightText(line.text, searchQuery)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="summary-panel">
          <h2>Summary</h2>
          <p>{meeting.summary}</p>

          <h3>Action items</h3>
          <ul>
            {meeting.actionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Topics</h3>
          <div className="chip-row">
            {meeting.topics.map((topic) => (
              <span key={topic} className="chip">
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
