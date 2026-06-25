import type { ReactNode } from "react";

type AppShellProps = {
  library: ReactNode;
  detail: ReactNode;
};

export function AppShell({ library, detail }: AppShellProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <p className="brand">Fireflies</p>
        <div className="search-box">
          <input type="text" value="Search meetings, people, or topics" readOnly />
        </div>
        <div className="filter-row">
          <span className="filter-chip">Recents</span>
          <span className="filter-chip">Team</span>
          <span className="filter-chip">Sales</span>
        </div>
        {library}
      </aside>
      {detail}
    </main>
  );
}
