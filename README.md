# Fireflies Clone - Meeting Notes And Transcription Platform

A fullstack Fireflies.ai-style meeting workspace built for the SDE Fullstack assignment. The app focuses on post-meeting workflows: meeting library, interactive transcript, AI-style summaries, action items, topics, search, exports, and seeded meeting data.

## Tech Stack

- Frontend: Next.js with TypeScript
- Backend: Python with FastAPI
- Database: SQLite

## Features

- Meetings dashboard with title, date, duration, participants, search, filters, and recency sorting
- Meeting detail view with transcript lines, speaker labels, timestamps, and playback-style seek sync
- Transcript search with highlighted matches
- AI-style summary, summary bullets, action items, topics, and chapter outline
- Action item checkbox workflow
- Meeting CRUD and action item CRUD API on the backend
- SQLite schema with meetings, participants, transcripts, summaries, topics, tags, and action items
- Settings, integrations, live bot, team sharing, and auth placeholders
- Bonus features: tag filtering, transcript highlights, TXT/Markdown export, and seeded meeting Q&A placeholder

## Project Structure

```text
.
+-- backend/
|   +-- app/
|   |   +-- api/
|   |   +-- core/
|   |   +-- services/
|   |   +-- db.py
|   |   +-- main.py
|   |   +-- schemas.py
|   +-- requirements.txt
+-- frontend/
|   +-- app/
|   +-- components/
|   +-- lib/
|   +-- package.json
+-- docs/
```

## Running Locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Backend URLs:

```text
http://127.0.0.1:8000
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/api/meetings
```

### Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

Production build:

```powershell
npm run build
npm run start
```

## Architecture Overview

The frontend is a Next.js TypeScript app that recreates a Fireflies-style workspace. It includes a meeting dashboard, interactive meeting detail page, transcript search, notes panel, action items, export controls, and placeholder surfaces for integrations and real-time bot features.

The backend is a FastAPI app with SQLite persistence. It initializes the database on startup, seeds demo meetings, and exposes meeting and action-item APIs. The backend is designed around simple service functions so database logic stays outside route handlers.

For the assignment timeline, real audio transcription is intentionally out of scope. Transcript data, AI summaries, action items, and chapters are seeded or mocked.

## Database Schema

The SQLite database is initialized from `backend/app/db.py`.

Main tables:

- `users`: default logged-in user placeholder
- `meetings`: meeting metadata such as title, date, duration, source type, and filename
- `meeting_participants`: normalized participant records
- `transcripts`: raw transcript text for each meeting
- `transcript_lines`: speaker-labeled transcript segments with timestamps
- `summaries`: seeded or mocked AI summary text
- `action_items`: meeting tasks with assignee and completion state
- `topics`: outline or chapter-style topic labels
- `tags`: optional tags for filtering
- `meeting_tags`: many-to-many meeting/tag relationship

## API Overview

```text
GET    /api/health
GET    /api/meetings
GET    /api/meetings/{meeting_id}
POST   /api/meetings
PATCH  /api/meetings/{meeting_id}
DELETE /api/meetings/{meeting_id}
POST   /api/meetings/{meeting_id}/action-items
PATCH  /api/action-items/{action_item_id}
DELETE /api/action-items/{action_item_id}
```

Useful query params for `GET /api/meetings`:

- `query`: search by meeting title or participant
- `participant`: filter by participant
- `meeting_date`: filter by date
- `sort`: `recent` or `oldest`

## Assumptions

- A default logged-in user is assumed.
- Real-time meeting bot behavior is represented as a placeholder.
- Actual speech-to-text transcription is out of scope.
- Transcript and summary data can be seeded or mocked.
- Integrations such as Zoom, Google Meet, calendar, and CRM are placeholders.
- The frontend currently uses seeded demo data for the interactive UI, while the backend provides the persisted API and database layer.

## Deployment Notes

Recommended deployment split:

- Frontend: Vercel
- Backend: Render or Railway
- Database: SQLite for demo deployment, or PostgreSQL if moving beyond the assignment scope

Before submission:

- Push the public GitHub repository
- Deploy the frontend
- Deploy the backend
- Add the live frontend URL and backend URL to the submission

## Evaluation Focus

This project is optimized for:

- core Fireflies-style meeting workflows
- clean UI and dashboard experience
- interactive transcript behavior
- structured database schema
- clear API design
- readable, explainable code
