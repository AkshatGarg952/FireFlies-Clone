 "use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "./sidebar";
import { MeetingCard } from "./meeting-card";
import { MeetingDetailPane } from "./meeting-detail-pane";

type SortMode = "recent" | "oldest";

function AnalyticsView({ meetings }: { meetings: any[] }) {
  const totalMeetings = meetings.length;
  const totalDurationMin = Math.round(meetings.reduce((sum, m) => sum + m.duration_seconds, 0) / 60);
  const averageMins = totalMeetings > 0 ? Math.round(totalDurationMin / totalMeetings) : 0;

  const participantCounts: Record<string, number> = {};
  meetings.forEach((m) => {
    (m.participants || []).forEach((p: string) => {
      participantCounts[p] = (participantCounts[p] || 0) + 1;
    });
  });
  const participantsList = Object.entries(participantCounts).sort((a, b) => b[1] - a[1]);

  return (
    <section className="detail-panel" style={{ flex: 1, padding: "24px", overflowY: "auto", height: "calc(100vh - 48px)" }}>
      <h2>Workspace Analytics</h2>
      <p className="muted" style={{ marginBottom: "20px" }}>Key metrics and collaboration overview</p>

      <div className="placeholder-grid" style={{ marginTop: "24px", marginBottom: "32px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        <div className="placeholder-tile" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
          <strong>Total Meetings</strong>
          <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--brand)", marginTop: "8px" }}>
            {totalMeetings}
          </span>
        </div>
        <div className="placeholder-tile" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
          <strong>Total Duration</strong>
          <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--teal)", marginTop: "8px" }}>
            {totalDurationMin} mins
          </span>
        </div>
        <div className="placeholder-tile" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
          <strong>Average Meeting</strong>
          <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--text-strong)", marginTop: "8px" }}>
            {averageMins} mins
          </span>
        </div>
      </div>

      <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div className="summary-panel" style={{ padding: "20px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3>Top Participants</h3>
          <p className="muted" style={{ marginBottom: "16px", fontSize: "0.85rem" }}>Most active workspace contributors</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {participantsList.map(([name, count]) => (
              <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 500 }}>{name}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)", background: "var(--surface-soft)", padding: "2px 8px", borderRadius: "12px" }}>
                  {count} meetings
                </span>
              </div>
            ))}
            {participantsList.length === 0 && <span className="muted">No participants found</span>}
          </div>
        </div>

        <div className="summary-panel" style={{ padding: "20px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--line)" }}>
          <h3>Activity by Tag</h3>
          <p className="muted" style={{ marginBottom: "16px", fontSize: "0.85rem" }}>Distribution across meeting categories</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from(new Set(meetings.flatMap((m) => m.tags || []))).map((tag) => {
              const tagCount = meetings.filter((m) => (m.tags || []).includes(tag)).length;
              const percentage = totalMeetings > 0 ? (tagCount / totalMeetings) * 100 : 0;
              return (
                <div key={tag} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <strong>{tag}</strong>
                    <span>{tagCount} meetings</span>
                  </div>
                  <div style={{ background: "var(--line)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ background: "var(--brand)", width: `${percentage}%`, height: "100%", borderRadius: "4px" }} />
                  </div>
                </div>
              );
            })}
            {meetings.flatMap((m) => m.tags || []).length === 0 && (
              <span className="muted">No tags found to categorize meetings.</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Dashboard() {
  const [currentTab, setCurrentTab] = useState<"dashboard" | "analytics">("dashboard");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [selectedMeetingLoading, setSelectedMeetingLoading] = useState(false);

  const [toast, setToast] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Creation form states
  const [createTitle, setCreateTitle] = useState("");
  const [createParticipants, setCreateParticipants] = useState("");
  const [createTranscriptText, setCreateTranscriptText] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  // Keyboard shortcut "/" to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (filter === "team") params.append("participant", "Aman");
      params.append("sort", sortMode);

      const res = await fetch(`http://localhost:8000/api/meetings?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch meetings");
      const data = await res.json();
      setMeetings(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [query, filter, sortMode]);

  // Load selected meeting detail
  useEffect(() => {
    if (selectedId === null) {
      setSelectedMeeting(null);
      return;
    }
    const fetchDetail = async () => {
      setSelectedMeetingLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/api/meetings/${selectedId}`);
        if (!res.ok) throw new Error("Failed to load meeting details");
        const data = await res.json();
        setSelectedMeeting(data);
      } catch (err: any) {
        showToast(err.message || "Error loading details");
        setSelectedMeeting(null);
      } finally {
        setSelectedMeetingLoading(false);
      }
    };
    fetchDetail();
  }, [selectedId]);

  const allTags = useMemo(() => {
    return Array.from(new Set(meetings.flatMap((m) => m.tags || []))).sort();
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => tagFilter === "all" || (meeting.tags || []).includes(tagFilter));
  }, [meetings, tagFilter]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      showToast("Uploading and parsing transcript...");
      const res = await fetch("http://localhost:8000/api/meetings/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      showToast("Meeting transcript parsed successfully!");
      setIsCreateOpen(false);
      fetchMeetings();
      setSelectedId(data.meeting.id);
    } catch (err: any) {
      showToast(err.message || "Error uploading file");
    }
  };

  const handleCreateMeeting = async () => {
    try {
      const payload = {
        title: createTitle.trim() || "Untitled Meeting",
        meeting_date: new Date().toISOString().split("T")[0],
        duration_seconds: 1800,
        participants: createParticipants.split(",").map((p) => p.trim()).filter(Boolean),
        source_type: "manual",
        transcript_text: createTranscriptText.trim(),
        transcript_lines: [
          {
            speaker_name: "Speaker 1",
            speaker_label: "S1",
            start_second: 0,
            end_second: 10,
            text: createTranscriptText.trim(),
            line_order: 0,
          },
        ],
        summary_text: "Summary of manual draft creation.",
        summary_bullets: ["Manually created draft meeting."],
        key_decisions: ["Complete setup and align next steps."],
        topics: ["General"],
        tags: ["Draft"],
        chapters: [
          {
            label: "Introduction",
            time: "00:00",
          },
        ],
        action_items: [],
      };

      const res = await fetch("http://localhost:8000/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create meeting");
      const data = await res.json();
      showToast("Meeting created successfully!");
      setIsCreateOpen(false);
      setCreateTitle("");
      setCreateParticipants("");
      setCreateTranscriptText("");
      fetchMeetings();
      setSelectedId(data.meeting.id);
    } catch (err: any) {
      showToast(err.message || "Error creating meeting");
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        selectedMeetingId={selectedId}
        setSelectedMeetingId={setSelectedId}
      />

      <main className="main-content">
        {currentTab === "analytics" ? (
          <AnalyticsView meetings={meetings} />
        ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100vh", overflow: "hidden", padding: "16px" }}>
            <header className="topbar">
              <div className="brand-lockup">
                <div>
                  <p className="eyebrow">Fireflies workspace</p>
                  <h1>Meetings Library</h1>
                </div>
              </div>
              <div className="topbar-actions">
                <button className="ghost-button" type="button" onClick={() => setIsSettingsOpen(true)}>
                  Settings
                </button>
              </div>
            </header>

            <section className="content-grid">
              <aside className="library-panel">
                <div className="panel-head" style={{ flexShrink: 0 }}>
                  <div>
                    <h2>Meeting library</h2>
                    <p className="muted">{filteredMeetings.length} meetings found</p>
                  </div>
                  <button className="primary-button" type="button" onClick={() => setIsCreateOpen(true)}>
                    + New
                  </button>
                </div>

                <label className="search-field" style={{ flexShrink: 0 }}>
                  <span>Search</span>
                  <input
                    type="text"
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Title, people, transcript..."
                  />
                </label>

                <div className="filter-toolbar" style={{ flexShrink: 0 }}>
                  <button type="button" className={`filter-chip${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>All</button>
                  <button type="button" className={`filter-chip${filter === "team" ? " active" : ""}`} onClick={() => setFilter("team")}>Team</button>
                  <button type="button" className={`filter-chip${sortMode === "recent" ? " active" : ""}`} onClick={() => setSortMode("recent")}>Recent</button>
                  <button type="button" className={`filter-chip${sortMode === "oldest" ? " active" : ""}`} onClick={() => setSortMode("oldest")}>Oldest</button>
                </div>

                <div className="tag-strip" style={{ flexShrink: 0 }}>
                  <button type="button" className={`tag-filter${tagFilter === "all" ? " active" : ""}`} onClick={() => setTagFilter("all")}>All tags</button>
                  {allTags.map((tag) => (
                    <button key={tag} type="button" className={`tag-filter${tagFilter === tag ? " active" : ""}`} onClick={() => setTagFilter(tag)}>{tag}</button>
                  ))}
                </div>

                <div className="meeting-list">
                  {loading ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }} className="muted">Loading meetings...</div>
                  ) : error ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "#d92d20", fontSize: "0.9rem" }}>{error}</div>
                  ) : filteredMeetings.length === 0 ? (
                    <div className="empty-state">
                      <strong>No meetings found.</strong>
                      <p>Try a different search or create a new meeting.</p>
                    </div>
                  ) : (
                    filteredMeetings.map((meeting) => (
                      <button key={meeting.id} className="meeting-button" type="button" onClick={() => setSelectedId(meeting.id)}>
                        <MeetingCard meeting={meeting} active={meeting.id === selectedId} />
                      </button>
                    ))
                  )}
                </div>
              </aside>

              {selectedMeetingLoading ? (
                <section className="detail-panel empty-detail" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px" }}>
                  <strong>Loading...</strong>
                  <p>Fetching meeting details from API.</p>
                </section>
              ) : selectedMeeting ? (
                <MeetingDetailPane
                  meeting={selectedMeeting}
                  onNotify={showToast}
                  onDelete={() => { setSelectedId(null); fetchMeetings(); }}
                  onUpdate={() => {
                    const id = selectedId;
                    setSelectedId(null);
                    setTimeout(() => { setSelectedId(id); fetchMeetings(); }, 50);
                  }}
                />
              ) : (
                <section className="detail-panel empty-detail" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🎙️</div>
                  <strong style={{ fontSize: "1.1rem" }}>No meeting selected</strong>
                  <p style={{ textAlign: "center", maxWidth: "260px" }}>Pick a meeting from the library to view its transcript, notes, and AI insights.</p>
                </section>
              )}
            </section>
          </div>
        )}
      </main>

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
                <p>Using default logged-in user profile</p>
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

            <div style={{ marginBottom: "20px", borderBottom: "1px solid var(--line)", paddingBottom: "16px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "8px" }}>
                Import via file upload (.vtt, .txt, .json)
              </span>
              <input type="file" accept=".vtt,.txt,.json" onChange={handleFileUpload} />
            </div>

            <div className="form-grid">
              <label>
                <span>Title</span>
                <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Q2 Launch Review" />
              </label>
              <label>
                <span>Participants (comma-separated)</span>
                <input value={createParticipants} onChange={(e) => setCreateParticipants(e.target.value)} placeholder="e.g. Aditi, Rahul, Meera" />
              </label>
              <label className="wide-field">
                <span>Transcript paste area</span>
                <textarea
                  value={createTranscriptText}
                  onChange={(e) => setCreateTranscriptText(e.target.value)}
                  placeholder="Paste meeting transcript details..."
                />
              </label>
            </div>
            <button className="primary-button" type="button" onClick={handleCreateMeeting} style={{ marginTop: "16px" }}>
              Save meeting
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
