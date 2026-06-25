"use client";

import { useMemo, useState } from "react";

import { meetings as seedMeetings } from "../lib/mock-data";
import type { MeetingPreview } from "../lib/types";
import { MeetingCard } from "./meeting-card";

type SortMode = "recent" | "oldest";

function parseMeetingDate(meeting: MeetingPreview): number {
  return new Date(`${meeting.date} ${meeting.time}`).getTime();
}

function matchesSearch(meeting: MeetingPreview, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (
    meeting.title.toLowerCase().includes(needle) ||
    meeting.participants.some((person) => person.toLowerCase().includes(needle)) ||
    meeting.topics.some((topic) => topic.toLowerCase().includes(needle))
  );
}

function matchesFilter(meeting: MeetingPreview, filter: string) {
  if (filter === "all") {
    return true;
  }

  if (filter === "team") {
    return meeting.participants.length >= 3;
  }

  if (filter === "sales") {
    return meeting.topics.some((topic) => topic.toLowerCase().includes("launch"));
  }

  return true;
}

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [selectedId, setSelectedId] = useState(seedMeetings[0]?.id ?? "");

  const visibleMeetings = useMemo(() => {
    return [...seedMeetings]
      .filter((meeting) => matchesSearch(meeting, query))
      .filter((meeting) => matchesFilter(meeting, filter))
      .sort((left, right) => {
        const diff = parseMeetingDate(left) - parseMeetingDate(right);
        return sortMode === "recent" ? -diff : diff;
      });
  }, [filter, query, sortMode]);

  const selectedMeeting = visibleMeetings.find((meeting) => meeting.id === selectedId) ?? visibleMeetings[0] ?? seedMeetings[0];

  const stats = [
    { label: "Meetings", value: seedMeetings.length },
    { label: "Today", value: 2 },
    { label: "Action items", value: 6 }
  ];

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fireflies workspace</p>
          <h1>Meetings</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" type="button">
            Settings
          </button>
          <div className="profile-pill">
            <span>AG</span>
            <div>
              <strong>Akshat</strong>
              <p>Default workspace</p>
            </div>
          </div>
        </div>
      </header>

      <section className="hero-strip">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </section>

      <section className="content-grid">
        <aside className="library-panel">
          <div className="panel-head">
            <div>
              <h2>Meeting library</h2>
              <p className="muted">{visibleMeetings.length} meetings found</p>
            </div>
            <button className="primary-button" type="button">
              New meeting
            </button>
          </div>

          <label className="search-field">
            <span>Search meetings</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, participant, topic"
            />
          </label>

          <div className="filter-toolbar">
            <button type="button" className={`filter-chip${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
              All
            </button>
            <button type="button" className={`filter-chip${filter === "team" ? " active" : ""}`} onClick={() => setFilter("team")}>
              Team
            </button>
            <button type="button" className={`filter-chip${filter === "sales" ? " active" : ""}`} onClick={() => setFilter("sales")}>
              Sales
            </button>
            <button
              type="button"
              className={`filter-chip${sortMode === "recent" ? " active" : ""}`}
              onClick={() => setSortMode("recent")}
            >
              Recent first
            </button>
            <button
              type="button"
              className={`filter-chip${sortMode === "oldest" ? " active" : ""}`}
              onClick={() => setSortMode("oldest")}
            >
              Oldest first
            </button>
          </div>

          <div className="meeting-list">
            {visibleMeetings.map((meeting) => (
              <button key={meeting.id} className="meeting-button" type="button" onClick={() => setSelectedId(meeting.id)}>
                <MeetingCard meeting={meeting} active={meeting.id === selectedMeeting?.id} />
              </button>
            ))}

            {visibleMeetings.length === 0 ? (
              <div className="empty-state">
                <strong>No meetings match this search.</strong>
                <p>Try a different title, participant, or topic filter.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="detail-panel">
          {selectedMeeting ? (
            <>
              <div className="panel-header">
                <p className="eyebrow">Selected meeting</p>
                <h1>{selectedMeeting.title}</h1>
                <p className="muted">
                  {selectedMeeting.date} at {selectedMeeting.time} - {selectedMeeting.duration}
                </p>
              </div>

              <div className="detail-meta-row">
                <div>
                  <span className="meta-label">Participants</span>
                  <p>{selectedMeeting.participants.join(", ")}</p>
                </div>
                <div>
                  <span className="meta-label">Topics</span>
                  <p>{selectedMeeting.topics.join(" · ")}</p>
                </div>
              </div>

              <div className="hero-note">
                <strong>Fireflies-style summary preview</strong>
                <p>{selectedMeeting.summary}</p>
              </div>

              <div className="detail-grid">
                <div className="transcript-panel">
                  <h2>Transcript preview</h2>
                  {selectedMeeting.transcript.slice(0, 4).map((line) => (
                    <div key={line.id} className="transcript-line">
                      <span className="speaker">{line.speaker}</span>
                      <span className="timestamp">{line.timestamp}</span>
                      <p>{line.text}</p>
                    </div>
                  ))}
                </div>

                <div className="summary-panel">
                  <h2>Notes</h2>
                  <p>{selectedMeeting.summary}</p>

                  <h3>Action items</h3>
                  <ul>
                    {selectedMeeting.actionItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>

                  <h3>Topics</h3>
                  <div className="chip-row">
                    {selectedMeeting.topics.map((topic) => (
                      <span key={topic} className="chip">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-detail">
              <strong>No meeting selected</strong>
              <p>Select a meeting from the library to inspect its transcript and notes.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
