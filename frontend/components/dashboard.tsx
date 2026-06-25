"use client";

import { useMemo, useState } from "react";

import { meetings as seedMeetings } from "../lib/mock-data";
import type { MeetingPreview } from "../lib/types";
import { MeetingCard } from "./meeting-card";
import { MeetingDetailPane } from "./meeting-detail-pane";

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
    meeting.topics.some((topic) => topic.toLowerCase().includes(needle)) ||
    meeting.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
    meeting.transcript.some((line) => line.text.toLowerCase().includes(needle))
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
  const [tagFilter, setTagFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [selectedId, setSelectedId] = useState(seedMeetings[0]?.id ?? "");
  const [toast, setToast] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const allTags = useMemo(() => {
    return Array.from(new Set(seedMeetings.flatMap((meeting) => meeting.tags))).sort();
  }, []);

  const visibleMeetings = useMemo(() => {
    return [...seedMeetings]
      .filter((meeting) => matchesSearch(meeting, query))
      .filter((meeting) => matchesFilter(meeting, filter))
      .filter((meeting) => tagFilter === "all" || meeting.tags.includes(tagFilter))
      .sort((left, right) => {
        const diff = parseMeetingDate(left) - parseMeetingDate(right);
        return sortMode === "recent" ? -diff : diff;
      });
  }, [filter, query, sortMode, tagFilter]);

  const selectedMeeting = visibleMeetings.find((meeting) => meeting.id === selectedId) ?? visibleMeetings[0] ?? null;

  const stats = [
    { label: "Meetings", value: seedMeetings.length },
    { label: "Today", value: 2 },
    { label: "Action items", value: seedMeetings.reduce((total, meeting) => total + meeting.actionItems.length, 0) },
  ];

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">F</span>
          <div>
            <p className="eyebrow">Fireflies workspace</p>
            <h1>Meetings</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" type="button" onClick={() => setIsSettingsOpen(true)}>
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
            <button className="primary-button" type="button" onClick={() => setIsCreateOpen(true)}>
              New meeting
            </button>
          </div>

          <label className="search-field">
            <span>Global search</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, people, tags, transcript"
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

          <div className="tag-strip">
            <button type="button" className={`tag-filter${tagFilter === "all" ? " active" : ""}`} onClick={() => setTagFilter("all")}>
              All tags
            </button>
            {allTags.map((tag) => (
              <button key={tag} type="button" className={`tag-filter${tagFilter === tag ? " active" : ""}`} onClick={() => setTagFilter(tag)}>
                {tag}
              </button>
            ))}
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

        {selectedMeeting ? (
          <MeetingDetailPane meeting={selectedMeeting} onNotify={showToast} />
        ) : (
          <section className="detail-panel empty-detail">
            <strong>No meeting selected</strong>
            <p>Select a meeting from the library or clear your filters to inspect its transcript and notes.</p>
          </section>
        )}
      </section>

      {toast ? <div className="toast">{toast}</div> : null}

      {isSettingsOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsSettingsOpen(false)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">Workspace</p>
                <h2 id="settings-title">Settings</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setIsSettingsOpen(false)}>
                Close
              </button>
            </div>
            <div className="placeholder-grid">
              <div className="placeholder-tile">
                <strong>Live meeting bot</strong>
                <p>Coming soon</p>
              </div>
              <div className="placeholder-tile">
                <strong>Integrations</strong>
                <p>Zoom, Meet, Calendar, and CRM placeholders</p>
              </div>
              <div className="placeholder-tile">
                <strong>Team sharing</strong>
                <p>Workspace collaboration placeholder</p>
              </div>
              <div className="placeholder-tile">
                <strong>Authentication</strong>
                <p>Using a default logged-in user for this assignment</p>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isCreateOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsCreateOpen(false)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">Create</p>
                <h2 id="create-title">New meeting</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setIsCreateOpen(false)}>
                Close
              </button>
            </div>
            <div className="form-grid">
              <label>
                <span>Title</span>
                <input value="Customer onboarding review" readOnly />
              </label>
              <label>
                <span>Participants</span>
                <input value="Aditi, Rahul, Meera" readOnly />
              </label>
              <label className="wide-field">
                <span>Transcript paste area</span>
                <textarea value="Transcript upload and paste flow is represented here for the MVP." readOnly />
              </label>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                showToast("Meeting creation placeholder opened successfully");
              }}
            >
              Save draft
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
