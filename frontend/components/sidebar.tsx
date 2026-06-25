"use client";

import React, { useEffect, useState } from "react";

interface SidebarProps {
  currentTab: "dashboard" | "analytics";
  setCurrentTab: (tab: "dashboard" | "analytics") => void;
  selectedMeetingId: number | null;
  setSelectedMeetingId: (id: number | null) => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  selectedMeetingId,
  setSelectedMeetingId,
}: SidebarProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Sync theme with DOM attribute
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const defaultTheme = savedTheme || "light";
    setTheme(defaultTheme);
    document.documentElement.setAttribute("data-theme", defaultTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const handleNavClick = (tab: "dashboard" | "analytics") => {
    setSelectedMeetingId(null);
    setCurrentTab(tab);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" onClick={() => handleNavClick("dashboard")}>
        <div className="sidebar-logo-icon">F</div>
        <span>Fireflies Clone</span>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: "6px",
            padding: "0 8px",
          }}
        >
          Workspace
        </label>
        <select
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            background: "var(--surface-soft)",
            color: "var(--text-strong)",
            fontSize: "0.85rem",
            fontWeight: 500,
            outline: "none",
          }}
        >
          <option>Personal Workspace</option>
          <option>Engineering Team</option>
          <option>Marketing Team</option>
        </select>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-item ${
            currentTab === "dashboard" && selectedMeetingId === null ? "active" : ""
          }`}
          onClick={() => handleNavClick("dashboard")}
        >
          <svg
            style={{ width: "20px", height: "20px" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span>Meetings Library</span>
        </button>

        <button
          className={`sidebar-item ${currentTab === "analytics" ? "active" : ""}`}
          onClick={() => handleNavClick("analytics")}
        >
          <svg
            style={{ width: "20px", height: "20px" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"
            />
          </svg>
          <span>Analytics</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="theme-toggle-btn" onClick={toggleTheme}>
          {theme === "light" ? (
            <>
              <svg
                style={{ width: "16px", height: "16px" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <svg
                style={{ width: "16px", height: "16px" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
                />
              </svg>
              <span>Light Mode</span>
            </>
          )}
        </button>

        <div className="sidebar-profile">
          <div className="sidebar-avatar">DU</div>
          <div className="sidebar-user-info">
            <span className="sidebar-username">Default User</span>
            <span className="sidebar-email">default@example.com</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
