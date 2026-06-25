from __future__ import annotations

import json
import sqlite3
from datetime import date
from typing import Any
import re

from fastapi import HTTPException

from app.db import get_connection, initialize_database
from app.schemas import (
    ActionItemCreate,
    ActionItemRead,
    ActionItemUpdate,
    MeetingCreate,
    MeetingDetail,
    MeetingListItem,
    MeetingUpdate,
    TranscriptLineCreate,
    TranscriptLineRead,
    ChapterCreate,
    ChapterRead,
    CommentCreate,
    CommentRead,
    SoundbiteCreate,
    SoundbiteRead,
)


def bootstrap_database() -> None:
    initialize_database()
    seed_database()


def _row_to_meeting_list_item(row: sqlite3.Row, tags: list[str]) -> MeetingListItem:
    participant_text = row["participants"] or ""
    participants = [name.strip() for name in participant_text.split(",") if name.strip()]
    return MeetingListItem(
        id=row["id"],
        title=row["title"],
        meeting_date=row["meeting_date"],
        duration_seconds=row["duration_seconds"],
        participants=participants,
        source_type=row["source_type"],
        source_filename=row["source_filename"],
        tags=tags,
    )


def _get_summary_fields(summary_text_raw: str | None) -> tuple[str, list[str]]:
    if not summary_text_raw:
        return "", []
    try:
        data = json.loads(summary_text_raw)
        if isinstance(data, dict):
            return data.get("summary_text", ""), data.get("bullets", [])
    except Exception:
        pass
    return summary_text_raw, []


def _build_meeting_detail(meeting_row: sqlite3.Row) -> MeetingDetail:
    meeting_id = meeting_row["id"]
    with get_connection() as connection:
        participants = [
            row["name"]
            for row in connection.execute(
                "SELECT name FROM meeting_participants WHERE meeting_id = ? ORDER BY id",
                (meeting_id,),
            ).fetchall()
        ]

        transcript_row = connection.execute(
            "SELECT id, raw_text FROM transcripts WHERE meeting_id = ?",
            (meeting_id,),
        ).fetchone()

        transcript_lines: list[TranscriptLineRead] = []
        transcript_text = None
        if transcript_row:
            transcript_text = transcript_row["raw_text"]
            transcript_lines = [
                TranscriptLineRead(
                    id=row["id"],
                    speaker_name=row["speaker_name"],
                    speaker_label=row["speaker_label"],
                    start_second=row["start_second"],
                    end_second=row["end_second"],
                    text=row["text"],
                    line_order=row["line_order"],
                )
                for row in connection.execute(
                    """
                    SELECT id, speaker_name, speaker_label, start_second, end_second, text, line_order
                    FROM transcript_lines
                    WHERE transcript_id = ?
                    ORDER BY line_order, id
                    """,
                    (transcript_row["id"],),
                ).fetchall()
            ]

        summary_row = connection.execute(
            "SELECT summary_text FROM summaries WHERE meeting_id = ?",
            (meeting_id,),
        ).fetchone()

        summary_text, summary_bullets = _get_summary_fields(summary_row["summary_text"] if summary_row else None)

        action_items = [
            ActionItemRead(
                id=row["id"],
                title=row["title"],
                description=row["description"],
                assignee_name=row["assignee_name"],
                due_date=row["due_date"],
                is_completed=bool(row["is_completed"]),
            )
            for row in connection.execute(
                """
                SELECT id, title, description, assignee_name, due_date, is_completed
                FROM action_items
                WHERE meeting_id = ?
                ORDER BY id
                """,
                (meeting_id,),
            ).fetchall()
        ]

        topics = [
            row["name"]
            for row in connection.execute(
                "SELECT name FROM topics WHERE meeting_id = ? ORDER BY sort_order, id",
                (meeting_id,),
            ).fetchall()
        ]

        key_decisions = [
            row["text"]
            for row in connection.execute(
                "SELECT text FROM key_decisions WHERE meeting_id = ? ORDER BY sort_order, id",
                (meeting_id,),
            ).fetchall()
        ]

        chapters = [
            ChapterRead(
                id=row["id"],
                label=row["label"],
                time=row["time"]
            )
            for row in connection.execute(
                "SELECT id, label, time FROM chapters WHERE meeting_id = ? ORDER BY sort_order, id",
                (meeting_id,),
            ).fetchall()
        ]

        comments = [
            CommentRead(
                id=row["id"],
                meeting_id=row["meeting_id"],
                transcript_line_id=row["transcript_line_id"],
                text=row["text"],
                created_at=row["created_at"]
            )
            for row in connection.execute(
                "SELECT id, meeting_id, transcript_line_id, text, created_at FROM comments WHERE meeting_id = ? ORDER BY id",
                (meeting_id,),
            ).fetchall()
        ]

        highlights = [
            row["transcript_line_id"]
            for row in connection.execute(
                "SELECT transcript_line_id FROM highlights WHERE meeting_id = ?",
                (meeting_id,),
            ).fetchall()
        ]

        soundbites = [
            SoundbiteRead(
                id=row["id"],
                meeting_id=row["meeting_id"],
                title=row["title"],
                start_second=row["start_second"],
                end_second=row["end_second"],
                created_at=row["created_at"]
            )
            for row in connection.execute(
                "SELECT id, meeting_id, title, start_second, end_second, created_at FROM soundbites WHERE meeting_id = ? ORDER BY id",
                (meeting_id,),
            ).fetchall()
        ]

        tags = [
            row["name"]
            for row in connection.execute(
                """
                SELECT t.name
                FROM tags t
                JOIN meeting_tags mt ON mt.tag_id = t.id
                WHERE mt.meeting_id = ?
                """,
                (meeting_id,),
            ).fetchall()
        ]

    return MeetingDetail(
        id=meeting_row["id"],
        title=meeting_row["title"],
        meeting_date=meeting_row["meeting_date"],
        duration_seconds=meeting_row["duration_seconds"],
        participants=participants,
        source_type=meeting_row["source_type"],
        source_filename=meeting_row["source_filename"],
        transcript_text=transcript_text,
        transcript_lines=transcript_lines,
        summary_text=summary_text,
        summary_bullets=summary_bullets,
        key_decisions=key_decisions,
        action_items=action_items,
        topics=topics,
        tags=tags,
        chapters=chapters,
        comments=comments,
        highlights=highlights,
        soundbites=soundbites,
    )


def list_meetings(
    query: str | None = None,
    participant: str | None = None,
    meeting_date: date | None = None,
    sort: str = "recent",
) -> list[MeetingListItem]:
    sql = """
        SELECT
            m.id,
            m.title,
            m.meeting_date,
            m.duration_seconds,
            m.source_type,
            m.source_filename,
            GROUP_CONCAT(mp.name, ', ') AS participants
        FROM meetings m
        LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id
    """
    clauses: list[str] = []
    params: list[Any] = []

    if query:
        clauses.append(
            """
            (
                LOWER(m.title) LIKE ?
                OR EXISTS (
                    SELECT 1
                    FROM meeting_participants mp2
                    WHERE mp2.meeting_id = m.id AND LOWER(mp2.name) LIKE ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM transcripts t
                    LEFT JOIN transcript_lines tl ON tl.transcript_id = t.id
                    WHERE t.meeting_id = m.id AND LOWER(tl.text) LIKE ?
                )
            )
            """
        )
        like = f"%{query.lower()}%"
        params.extend([like, like, like])

    if participant:
        clauses.append(
            """
            EXISTS (
                SELECT 1
                FROM meeting_participants mp3
                WHERE mp3.meeting_id = m.id AND LOWER(mp3.name) LIKE ?
            )
            """
        )
        params.append(f"%{participant.lower()}%")

    if meeting_date:
        clauses.append("m.meeting_date = ?")
        params.append(meeting_date.isoformat())

    if clauses:
        sql += " WHERE " + " AND ".join(f"({clause.strip()})" for clause in clauses)

    sql += " GROUP BY m.id"
    if sort == "oldest":
        sql += " ORDER BY m.meeting_date ASC, m.id ASC"
    else:
        sql += " ORDER BY m.meeting_date DESC, m.id DESC"

    with get_connection() as connection:
        rows = connection.execute(sql, params).fetchall()
        items = []
        for row in rows:
            meeting_id = row["id"]
            tags = [
                r["name"]
                for r in connection.execute(
                    """
                    SELECT t.name
                    FROM tags t
                    JOIN meeting_tags mt ON mt.tag_id = t.id
                    WHERE mt.meeting_id = ?
                    """,
                    (meeting_id,),
                ).fetchall()
            ]
            items.append(_row_to_meeting_list_item(row, tags))
        return items


def get_meeting(meeting_id: int) -> MeetingDetail | None:
    with get_connection() as connection:
        meeting_row = connection.execute(
            """
            SELECT id, user_id, title, meeting_date, duration_seconds, source_type, source_filename
            FROM meetings
            WHERE id = ?
            """,
            (meeting_id,),
        ).fetchone()

    if not meeting_row:
        return None

    return _build_meeting_detail(meeting_row)


def _replace_participants(connection: sqlite3.Connection, meeting_id: int, participants: list[str]) -> None:
    connection.execute("DELETE FROM meeting_participants WHERE meeting_id = ?", (meeting_id,))
    for name in participants:
        if name.strip():
            connection.execute(
                "INSERT INTO meeting_participants (meeting_id, name, role) VALUES (?, ?, ?)",
                (meeting_id, name.strip(), None),
            )


def _replace_topics(connection: sqlite3.Connection, meeting_id: int, topics: list[str]) -> None:
    connection.execute("DELETE FROM topics WHERE meeting_id = ?", (meeting_id,))
    for sort_order, topic in enumerate(topics):
        if topic.strip():
            connection.execute(
                "INSERT INTO topics (meeting_id, name, sort_order) VALUES (?, ?, ?)",
                (meeting_id, topic.strip(), sort_order),
            )


def _replace_tags(connection: sqlite3.Connection, meeting_id: int, tags: list[str]) -> None:
    connection.execute("DELETE FROM meeting_tags WHERE meeting_id = ?", (meeting_id,))
    for tag_name in tags:
        tag_name = tag_name.strip()
        if not tag_name:
            continue
        connection.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", (tag_name,))
        tag_row = connection.execute("SELECT id FROM tags WHERE name = ?", (tag_name,)).fetchone()
        if tag_row:
            connection.execute(
                "INSERT OR IGNORE INTO meeting_tags (meeting_id, tag_id) VALUES (?, ?)",
                (meeting_id, tag_row["id"]),
            )


def _replace_key_decisions(connection: sqlite3.Connection, meeting_id: int, key_decisions: list[str]) -> None:
    connection.execute("DELETE FROM key_decisions WHERE meeting_id = ?", (meeting_id,))
    for sort_order, text in enumerate(key_decisions):
        if text.strip():
            connection.execute(
                "INSERT INTO key_decisions (meeting_id, text, sort_order) VALUES (?, ?, ?)",
                (meeting_id, text.strip(), sort_order),
            )


def _replace_chapters(connection: sqlite3.Connection, meeting_id: int, chapters: list[ChapterCreate]) -> None:
    connection.execute("DELETE FROM chapters WHERE meeting_id = ?", (meeting_id,))
    for sort_order, chapter in enumerate(chapters):
        connection.execute(
            "INSERT INTO chapters (meeting_id, label, time, sort_order) VALUES (?, ?, ?, ?)",
            (meeting_id, chapter.label, chapter.time, sort_order),
        )


def _replace_summary(
    connection: sqlite3.Connection,
    meeting_id: int,
    summary_text: str | None,
    summary_bullets: list[str] | None = None
) -> None:
    connection.execute("DELETE FROM summaries WHERE meeting_id = ?", (meeting_id,))
    if summary_text or summary_bullets:
        data = {
            "summary_text": summary_text or "",
            "bullets": summary_bullets or []
        }
        connection.execute(
            "INSERT INTO summaries (meeting_id, summary_text, created_by) VALUES (?, ?, ?)",
            (meeting_id, json.dumps(data), "system"),
        )


def _replace_transcript(
    connection: sqlite3.Connection,
    meeting_id: int,
    transcript_text: str | None,
    transcript_lines: list[TranscriptLineCreate] | None,
) -> None:
    connection.execute("DELETE FROM transcripts WHERE meeting_id = ?", (meeting_id,))
    transcript_cursor = connection.execute(
        "INSERT INTO transcripts (meeting_id, source_language, raw_text) VALUES (?, ?, ?)",
        (meeting_id, "en", transcript_text),
    )
    transcript_id = transcript_cursor.lastrowid

    lines = transcript_lines or []
    if not lines and transcript_text:
        lines = [
            TranscriptLineCreate(
                speaker_name="Speaker 1",
                speaker_label="S1",
                start_second=0,
                end_second=0,
                text=transcript_text,
                line_order=0,
            )
        ]

    for line in lines:
        connection.execute(
            """
            INSERT INTO transcript_lines (
                transcript_id, speaker_name, speaker_label, start_second, end_second, text, line_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transcript_id,
                line.speaker_name,
                line.speaker_label,
                line.start_second,
                line.end_second,
                line.text,
                line.line_order,
            ),
        )


def _insert_action_items(connection: sqlite3.Connection, meeting_id: int, action_items: list[ActionItemCreate]) -> None:
    for item in action_items:
        connection.execute(
            """
            INSERT INTO action_items (
                meeting_id, title, description, assignee_name, due_date, is_completed
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                meeting_id,
                item.title,
                item.description,
                item.assignee_name,
                item.due_date.isoformat() if item.due_date else None,
                int(item.is_completed),
            ),
        )


def create_meeting(payload: MeetingCreate) -> MeetingDetail:
    with get_connection() as connection:
        meeting_cursor = connection.execute(
            """
            INSERT INTO meetings (
                user_id, title, meeting_date, duration_seconds, source_type, source_filename
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                payload.title,
                payload.meeting_date.isoformat(),
                payload.duration_seconds,
                payload.source_type,
                payload.source_filename,
            ),
        )
        meeting_id = meeting_cursor.lastrowid
        _replace_participants(connection, meeting_id, payload.participants)
        _replace_summary(connection, meeting_id, payload.summary_text, payload.summary_bullets)
        _replace_key_decisions(connection, meeting_id, payload.key_decisions)
        _replace_topics(connection, meeting_id, payload.topics)
        _replace_tags(connection, meeting_id, payload.tags)
        _replace_chapters(connection, meeting_id, payload.chapters)
        _replace_transcript(connection, meeting_id, payload.transcript_text, payload.transcript_lines)
        _insert_action_items(connection, meeting_id, payload.action_items)

    meeting = get_meeting(meeting_id)
    if meeting is None:
        raise HTTPException(status_code=500, detail="Meeting creation failed")
    return meeting


def update_meeting(meeting_id: int, payload: MeetingUpdate) -> MeetingDetail:
    existing = get_meeting(meeting_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    updates: list[str] = []
    params: list[Any] = []
    if payload.title is not None:
        updates.append("title = ?")
        params.append(payload.title)
    if payload.meeting_date is not None:
        updates.append("meeting_date = ?")
        params.append(payload.meeting_date.isoformat())
    if payload.duration_seconds is not None:
        updates.append("duration_seconds = ?")
        params.append(payload.duration_seconds)
    if payload.source_type is not None:
        updates.append("source_type = ?")
        params.append(payload.source_type)
    if payload.source_filename is not None:
        updates.append("source_filename = ?")
        params.append(payload.source_filename)

    with get_connection() as connection:
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(meeting_id)
            connection.execute(
                f"UPDATE meetings SET {', '.join(updates)} WHERE id = ?",
                params,
            )

        if payload.participants is not None:
            _replace_participants(connection, meeting_id, payload.participants)
        if payload.topics is not None:
            _replace_topics(connection, meeting_id, payload.topics)
        if payload.tags is not None:
            _replace_tags(connection, meeting_id, payload.tags)
        if payload.chapters is not None:
            _replace_chapters(connection, meeting_id, payload.chapters)
        if payload.key_decisions is not None:
            _replace_key_decisions(connection, meeting_id, payload.key_decisions)

        if payload.summary_text is not None or payload.summary_bullets is not None:
            summary_text = payload.summary_text if payload.summary_text is not None else existing.summary_text
            summary_bullets = payload.summary_bullets if payload.summary_bullets is not None else existing.summary_bullets
            _replace_summary(connection, meeting_id, summary_text, summary_bullets)

        if payload.transcript_text is not None or payload.transcript_lines is not None:
            transcript_text = payload.transcript_text if payload.transcript_text is not None else existing.transcript_text
            transcript_lines = payload.transcript_lines
            if transcript_lines is None and payload.transcript_text is None:
                transcript_lines = existing.transcript_lines
            _replace_transcript(
                connection,
                meeting_id,
                transcript_text,
                transcript_lines,
            )

    meeting = get_meeting(meeting_id)
    if meeting is None:
        raise HTTPException(status_code=500, detail="Meeting update failed")
    return meeting


def delete_meeting(meeting_id: int) -> None:
    with get_connection() as connection:
        result = connection.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Meeting not found")


# --- COMMENTS SERVICE ---
def add_comment(meeting_id: int, payload: CommentCreate) -> CommentRead:
    if get_meeting(meeting_id) is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO comments (meeting_id, transcript_line_id, text) VALUES (?, ?, ?)",
            (meeting_id, payload.transcript_line_id, payload.text),
        )
        comment_id = cursor.lastrowid
        row = connection.execute(
            "SELECT created_at FROM comments WHERE id = ?", (comment_id,)
        ).fetchone()

    return CommentRead(
        id=comment_id,
        meeting_id=meeting_id,
        transcript_line_id=payload.transcript_line_id,
        text=payload.text,
        created_at=row["created_at"],
    )


def update_comment(comment_id: int, text: str) -> CommentRead:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, meeting_id, transcript_line_id, text, created_at FROM comments WHERE id = ?",
            (comment_id,),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Comment not found")

        connection.execute(
            "UPDATE comments SET text = ? WHERE id = ?",
            (text, comment_id),
        )

    return CommentRead(
        id=row["id"],
        meeting_id=row["meeting_id"],
        transcript_line_id=row["transcript_line_id"],
        text=text,
        created_at=row["created_at"],
    )


def delete_comment(comment_id: int) -> None:
    with get_connection() as connection:
        res = connection.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Comment not found")


# --- HIGHLIGHTS SERVICE ---
def toggle_highlight(meeting_id: int, transcript_line_id: int) -> bool:
    if get_meeting(meeting_id) is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    with get_connection() as connection:
        existing = connection.execute(
            "SELECT 1 FROM highlights WHERE meeting_id = ? AND transcript_line_id = ?",
            (meeting_id, transcript_line_id),
        ).fetchone()

        if existing:
            connection.execute(
                "DELETE FROM highlights WHERE meeting_id = ? AND transcript_line_id = ?",
                (meeting_id, transcript_line_id),
            )
            return False
        else:
            connection.execute(
                "INSERT INTO highlights (meeting_id, transcript_line_id) VALUES (?, ?)",
                (meeting_id, transcript_line_id),
            )
            return True


# --- SOUNDBITES SERVICE ---
def add_soundbite(meeting_id: int, payload: SoundbiteCreate) -> SoundbiteRead:
    if get_meeting(meeting_id) is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO soundbites (meeting_id, title, start_second, end_second) VALUES (?, ?, ?, ?)",
            (meeting_id, payload.title, payload.start_second, payload.end_second),
        )
        sb_id = cursor.lastrowid
        row = connection.execute(
            "SELECT created_at FROM soundbites WHERE id = ?", (sb_id,)
        ).fetchone()

    return SoundbiteRead(
        id=sb_id,
        meeting_id=meeting_id,
        title=payload.title,
        start_second=payload.start_second,
        end_second=payload.end_second,
        created_at=row["created_at"]
    )


def delete_soundbite(soundbite_id: int) -> None:
    with get_connection() as connection:
        res = connection.execute("DELETE FROM soundbites WHERE id = ?", (soundbite_id,))
        if res.rowcount == 0:
            raise HTTPException(status_code=404, detail="Soundbite not found")


# --- ANALYTICS SERVICE ---
def get_analytics(meeting_id: int) -> dict:
    meeting = get_meeting(meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    word_count = 0
    if meeting.transcript_lines:
        word_count = sum(len(line.text.split()) for line in meeting.transcript_lines)
    elif meeting.transcript_text:
        word_count = len(meeting.transcript_text.split())

    speaker_durations = {}
    total_talk_time = 0
    for line in meeting.transcript_lines:
        dur = max(1, line.end_second - line.start_second)
        speaker_durations[line.speaker_name] = speaker_durations.get(line.speaker_name, 0) + dur
        total_talk_time += dur

    speaker_stats = []
    for speaker, duration in speaker_durations.items():
        pct = round((duration / total_talk_time) * 100, 1) if total_talk_time > 0 else 0
        speaker_stats.append({
            "speaker": speaker,
            "duration_seconds": duration,
            "percentage": pct
        })

    num_actions = len(meeting.action_items)
    completed_actions = sum(1 for item in meeting.action_items if item.is_completed)

    return {
        "word_count": word_count,
        "speaker_talk_times": speaker_stats,
        "total_action_items": num_actions,
        "completed_action_items": completed_actions,
        "duration_seconds": meeting.duration_seconds
    }


# --- ASSISTANT Q&A CHAT SERVICE ---
def ask_meeting_question(meeting_id: int, question: str) -> str:
    meeting = get_meeting(meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    q_lower = question.lower()

    if "action" in q_lower or "task" in q_lower or "todo" in q_lower:
        if not meeting.action_items:
            return "Based on the transcript, there are no action items listed for this meeting."
        actions_str = ", ".join([f"'{item.title}' (assigned to {item.assignee_name or 'unassigned'})" for item in meeting.action_items])
        return f"Here are the action items identified in this meeting: {actions_str}."

    if "decision" in q_lower or "decided" in q_lower or "conclude" in q_lower:
        if meeting.key_decisions:
            decisions_str = "; ".join(meeting.key_decisions)
            return f"The following decisions were made during the meeting: {decisions_str}."
        decisions = []
        for line in meeting.transcript_lines:
            if "decide" in line.text.lower() or "agree" in line.text.lower() or "we will" in line.text.lower():
                decisions.append(f"\"{line.text}\" ({line.speaker_name})")
        if decisions:
            return f"From the transcript, here are some moments where decisions/agreements occurred: {'; '.join(decisions[:3])}."
        return "I didn't find any explicit key decisions recorded or discussed in this meeting."

    if "topic" in q_lower or "chapter" in q_lower or "agenda" in q_lower or "outline" in q_lower:
        if meeting.chapters:
            chapters_str = ", ".join([f"'{c.label}' starting at {c.time}" for c in meeting.chapters])
            return f"The meeting outlines these chapters: {chapters_str}."
        return f"The main topics discussed were: {', '.join(meeting.topics)}."

    matching_lines = []
    for line in meeting.transcript_lines:
        if any(word in line.text.lower() for word in q_lower.split() if len(word) > 3):
            matching_lines.append(f"At {line.start_second}s, {line.speaker_name} said: \"{line.text}\"")
            if len(matching_lines) >= 3:
                break

    if matching_lines:
        return "I found some relevant discussion in the transcript:\n" + "\n".join(matching_lines)

    return f"Based on the AI summary, the meeting focused on: {meeting.summary_text or 'No summary text is available.'}"


# --- UPLOAD PARSERS ---
def parse_vtt(content: str) -> tuple[list[TranscriptLineCreate], str]:
    lines = content.splitlines()
    transcript_lines = []
    full_text_parts = []
    time_pattern = re.compile(r"(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})")
    time_pattern_short = re.compile(r"(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2})\.(\d{3})")

    current_start_sec = 0
    current_end_sec = 0
    line_order = 0

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        match = time_pattern.search(line)
        match_short = time_pattern_short.search(line)
        if match:
            h1, m1, s1, _, h2, m2, s2, _ = map(int, match.groups())
            current_start_sec = h1 * 3600 + m1 * 60 + s1
            current_end_sec = h2 * 3600 + m2 * 60 + s2
            i += 1
            text_lines = []
            while i < len(lines) and lines[i].strip() and not time_pattern.search(lines[i]) and not time_pattern_short.search(lines[i]):
                text_lines.append(lines[i].strip())
                i += 1
            text = " ".join(text_lines)
            if text:
                speaker = "Speaker"
                speaker_label = "SP"
                if ":" in text:
                    sp_part, txt_part = text.split(":", 1)
                    if len(sp_part) < 25 and not any(c in sp_part for c in "<>{}[]"):
                        speaker = sp_part.strip()
                        speaker_label = "".join([w[0] for w in speaker.split() if w])[:2].upper() or "SP"
                        text = txt_part.strip()
                transcript_lines.append(
                    TranscriptLineCreate(
                        speaker_name=speaker,
                        speaker_label=speaker_label,
                        start_second=current_start_sec,
                        end_second=current_end_sec,
                        text=text,
                        line_order=line_order
                    )
                )
                full_text_parts.append(f"{speaker}: {text}")
                line_order += 1
        elif match_short:
            m1, s1, _, m2, s2, _ = map(int, match_short.groups())
            current_start_sec = m1 * 60 + s1
            current_end_sec = m2 * 60 + s2
            i += 1
            text_lines = []
            while i < len(lines) and lines[i].strip() and not time_pattern.search(lines[i]) and not time_pattern_short.search(lines[i]):
                text_lines.append(lines[i].strip())
                i += 1
            text = " ".join(text_lines)
            if text:
                speaker = "Speaker"
                speaker_label = "SP"
                if ":" in text:
                    sp_part, txt_part = text.split(":", 1)
                    if len(sp_part) < 25 and not any(c in sp_part for c in "<>{}[]"):
                        speaker = sp_part.strip()
                        speaker_label = "".join([w[0] for w in speaker.split() if w])[:2].upper() or "SP"
                        text = txt_part.strip()
                transcript_lines.append(
                    TranscriptLineCreate(
                        speaker_name=speaker,
                        speaker_label=speaker_label,
                        start_second=current_start_sec,
                        end_second=current_end_sec,
                        text=text,
                        line_order=line_order
                    )
                )
                full_text_parts.append(f"{speaker}: {text}")
                line_order += 1
        else:
            i += 1
    return transcript_lines, " ".join(full_text_parts)


def parse_json(content: str) -> tuple[list[TranscriptLineCreate], str]:
    data = json.loads(content)
    transcript_lines = []
    full_text_parts = []

    items = []
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        if "transcript" in data:
            items = data["transcript"]
        elif "lines" in data:
            items = data["lines"]

    for idx, item in enumerate(items):
        speaker = item.get("speaker") or item.get("speaker_name") or f"Speaker {item.get('speaker_id', 1)}"
        text = item.get("text") or item.get("message") or ""
        start_sec = item.get("start_second") or item.get("start") or 0
        end_sec = item.get("end_second") or item.get("end") or start_sec + 5

        timestamp = item.get("timestamp") or item.get("time")
        if timestamp and not start_sec:
            parts = timestamp.split(":")
            if len(parts) == 2:
                start_sec = int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                start_sec = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])

        speaker_label = "".join([w[0] for w in speaker.split() if w])[:2].upper() or "SP"
        transcript_lines.append(
            TranscriptLineCreate(
                speaker_name=speaker,
                speaker_label=speaker_label,
                start_second=start_sec,
                end_second=end_sec,
                text=text,
                line_order=idx
            )
        )
        full_text_parts.append(f"{speaker}: {text}")

    return transcript_lines, " ".join(full_text_parts)


def parse_txt(content: str) -> tuple[list[TranscriptLineCreate], str]:
    lines = content.splitlines()
    transcript_lines = []
    full_text_parts = []
    line_order = 0

    pattern_with_time = re.compile(r"^([^:(]+)(?:\s*\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?)?:\s*(.*)$")

    for line in lines:
        line = line.strip()
        if not line:
            continue
        match = pattern_with_time.match(line)
        if match:
            speaker = match.group(1).strip()
            time_str = match.group(2)
            text = match.group(3).strip()

            start_sec = 0
            if time_str:
                parts = time_str.split(":")
                if len(parts) == 2:
                    start_sec = int(parts[0]) * 60 + int(parts[1])
                elif len(parts) == 3:
                    start_sec = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])

            speaker_label = "".join([w[0] for w in speaker.split() if w])[:2].upper() or "SP"
            transcript_lines.append(
                TranscriptLineCreate(
                    speaker_name=speaker,
                    speaker_label=speaker_label,
                    start_second=start_sec,
                    end_second=start_sec + 5,
                    text=text,
                    line_order=line_order
                )
            )
            full_text_parts.append(f"{speaker}: {text}")
            line_order += 1
        else:
            speaker = "Speaker 1"
            speaker_label = "S1"
            transcript_lines.append(
                TranscriptLineCreate(
                    speaker_name=speaker,
                    speaker_label=speaker_label,
                    start_second=line_order * 5,
                    end_second=line_order * 5 + 5,
                    text=line,
                    line_order=line_order
                )
            )
            full_text_parts.append(f"{speaker}: {line}")
            line_order += 1
    return transcript_lines, " ".join(full_text_parts)


def parse_and_create_uploaded_meeting(filename: str, content: str) -> MeetingDetail:
    ext = filename.split(".")[-1].lower()
    if ext == "vtt":
        lines, raw = parse_vtt(content)
    elif ext == "json":
        lines, raw = parse_json(content)
    else:
        lines, raw = parse_txt(content)

    # Automatically extract details
    title = filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()
    participants = list(set([line.speaker_name for line in lines]))
    
    # Calculate duration
    duration = 0
    if lines:
        duration = max(line.end_second for line in lines)

    # Generate a simple mock summary
    summary = f"Summary of {title}. The participants had a discussion on various topics."
    bullets = [f"Discussed primary points.", f"{len(lines)} transcript segments were processed."]
    decisions = ["Aligned on final launch milestones."]
    
    # Auto-generate some chapters
    chapters = []
    if lines:
        step = max(1, len(lines) // 4)
        for i in range(0, len(lines), step):
            l = lines[i]
            m = l.start_second // 60
            s = l.start_second % 60
            chapters.append(
                ChapterCreate(
                    label=f"Discussion: Segment {i//step + 1}",
                    time=f"{m:02d}:{s:02d}"
                )
            )

    payload = MeetingCreate(
        title=title,
        meeting_date=date.today(),
        duration_seconds=duration,
        participants=participants,
        source_type="upload",
        source_filename=filename,
        transcript_text=raw,
        transcript_lines=lines,
        summary_text=summary,
        summary_bullets=bullets,
        key_decisions=decisions,
        topics=["Upload", "General"],
        tags=["Uploaded"],
        chapters=chapters,
        action_items=[
            ActionItemCreate(title="Review uploaded notes", assignee_name=participants[0] if participants else "User")
        ]
    )
    return create_meeting(payload)


# --- ACTION ITEMS SERVICE ---
def add_action_item(meeting_id: int, payload: ActionItemCreate) -> ActionItemRead:
    if get_meeting(meeting_id) is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO action_items (
                meeting_id, title, description, assignee_name, due_date, is_completed
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                meeting_id,
                payload.title,
                payload.description,
                payload.assignee_name,
                payload.due_date.isoformat() if payload.due_date else None,
                int(payload.is_completed),
            ),
        )
        action_item_id = cursor.lastrowid

    return ActionItemRead(
        id=action_item_id,
        title=payload.title,
        description=payload.description,
        assignee_name=payload.assignee_name,
        due_date=payload.due_date,
        is_completed=payload.is_completed,
    )


def update_action_item(action_item_id: int, payload: ActionItemUpdate) -> ActionItemRead:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, meeting_id, title, description, assignee_name, due_date, is_completed
            FROM action_items
            WHERE id = ?
            """,
            (action_item_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail="Action item not found")

        updates: list[str] = []
        params: list[Any] = []
        if payload.title is not None:
            updates.append("title = ?")
            params.append(payload.title)
        if payload.description is not None:
            updates.append("description = ?")
            params.append(payload.description)
        if payload.assignee_name is not None:
            updates.append("assignee_name = ?")
            params.append(payload.assignee_name)
        if payload.due_date is not None:
            updates.append("due_date = ?")
            params.append(payload.due_date.isoformat() if payload.due_date else None)
        if payload.is_completed is not None:
            updates.append("is_completed = ?")
            params.append(int(payload.is_completed))

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(action_item_id)
            connection.execute(
                f"UPDATE action_items SET {', '.join(updates)} WHERE id = ?",
                params,
            )

        updated = connection.execute(
            """
            SELECT id, title, description, assignee_name, due_date, is_completed
            FROM action_items
            WHERE id = ?
            """,
            (action_item_id,),
        ).fetchone()

    return ActionItemRead(
        id=updated["id"],
        title=updated["title"],
        description=updated["description"],
        assignee_name=updated["assignee_name"],
        due_date=date.fromisoformat(updated["due_date"]) if updated["due_date"] else None,
        is_completed=bool(updated["is_completed"]),
    )


def delete_action_item(action_item_id: int) -> None:
    with get_connection() as connection:
        result = connection.execute("DELETE FROM action_items WHERE id = ?", (action_item_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Action item not found")


def seed_database() -> None:
    with get_connection() as connection:
        meeting_count = connection.execute("SELECT COUNT(*) FROM meetings").fetchone()[0]
        if meeting_count:
            return

        connection.execute(
            "INSERT INTO users (name, email, avatar_url) VALUES (?, ?, ?)",
            ("Default User", "default@example.com", None),
        )

        # Seed with details including summary bullets, key decisions, chapters and tags
        seed_payloads = [
            MeetingCreate(
                title="Q2 Launch Review",
                meeting_date=date(2026, 6, 24),
                duration_seconds=2520,
                participants=["Aditi", "Rahul", "Meera"],
                source_type="seeded",
                source_filename="q2-launch-review.vtt",
                transcript_text="A launch readiness review with final checklist discussion.",
                transcript_lines=[
                    TranscriptLineCreate(
                        speaker_name="Aditi",
                        speaker_label="AD",
                        start_second=8,
                        end_second=19,
                        text="Let's review where we are on launch readiness.",
                        line_order=0,
                    ),
                    TranscriptLineCreate(
                        speaker_name="Rahul",
                        speaker_label="RH",
                        start_second=21,
                        end_second=33,
                        text="Engineering is done, but we still need the final checklist.",
                        line_order=1,
                    ),
                    TranscriptLineCreate(
                        speaker_name="Meera",
                        speaker_label="ME",
                        start_second=34,
                        end_second=45,
                        text="I will update the copy and share the final version today.",
                        line_order=2,
                    ),
                    TranscriptLineCreate(
                        speaker_name="Aditi",
                        speaker_label="AD",
                        start_second=49,
                        end_second=58,
                        text="Good, let's lock the launch owner before end of day.",
                        line_order=3,
                    ),
                ],
                summary_text="The team aligned on launch readiness, timeline risks, and the final marketing checklist.",
                summary_bullets=[
                    "Launch readiness is on track, with engineering work already complete.",
                    "The final checklist still needs review before sign-off.",
                    "Marketing copy will be updated and shared today."
                ],
                key_decisions=[
                    "Lock the launch owner before the end of the day today.",
                    "Complete landing page marketing copy and publish today."
                ],
                action_items=[
                    ActionItemCreate(title="Finalize landing page copy", assignee_name="Meera"),
                    ActionItemCreate(title="Confirm launch owner", assignee_name="Aditi"),
                ],
                topics=["Launch", "Timeline", "Marketing"],
                tags=["Launch", "Marketing", "Decision"],
                chapters=[
                    ChapterCreate(label="Launch readiness", time="00:08"),
                    ChapterCreate(label="Checklist blockers", time="00:21"),
                    ChapterCreate(label="Marketing follow-up", time="00:34"),
                    ChapterCreate(label="Ownership decision", time="00:49"),
                ]
            ),
            MeetingCreate(
                title="Weekly Product Sync",
                meeting_date=date(2026, 6, 23),
                duration_seconds=1860,
                participants=["Aman", "Nisha", "Karan"],
                source_type="seeded",
                source_filename="weekly-product-sync.txt",
                transcript_text="The product team aligned on sprint priorities and open UX cleanup items.",
                transcript_lines=[
                    TranscriptLineCreate(
                        speaker_name="Aman",
                        speaker_label="AM",
                        start_second=10,
                        end_second=18,
                        text="We need to close the onboarding feedback loop.",
                        line_order=0,
                    ),
                    TranscriptLineCreate(
                        speaker_name="Nisha",
                        speaker_label="NI",
                        start_second=24,
                        end_second=31,
                        text="The new layout is ready for review.",
                        line_order=1,
                    ),
                ],
                summary_text="Product and design aligned on the next sprint goals and the open UX cleanup items.",
                summary_bullets=[
                    "The onboarding feedback loop is the main product priority.",
                    "The updated UX layout is ready for team review."
                ],
                key_decisions=[
                    "Keep the next sprint narrow to ensure prototype shipment."
                ],
                action_items=[
                    ActionItemCreate(title="Refine onboarding flow", assignee_name="Nisha"),
                    ActionItemCreate(title="Collect customer feedback", assignee_name="Karan"),
                ],
                topics=["Product", "UX", "Sprint"],
                tags=["Product", "Design", "Sprint"],
                chapters=[
                    ChapterCreate(label="Onboarding feedback", time="00:10"),
                    ChapterCreate(label="Layout review", time="00:24"),
                ]
            ),
        ]

        for payload in seed_payloads:
            meeting_cursor = connection.execute(
                """
                INSERT INTO meetings (
                    user_id, title, meeting_date, duration_seconds, source_type, source_filename
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    1,
                    payload.title,
                    payload.meeting_date.isoformat(),
                    payload.duration_seconds,
                    payload.source_type,
                    payload.source_filename,
                ),
            )
            meeting_id = meeting_cursor.lastrowid
            _replace_participants(connection, meeting_id, payload.participants)
            _replace_summary(connection, meeting_id, payload.summary_text, payload.summary_bullets)
            _replace_key_decisions(connection, meeting_id, payload.key_decisions)
            _replace_topics(connection, meeting_id, payload.topics)
            _replace_tags(connection, meeting_id, payload.tags)
            _replace_chapters(connection, meeting_id, payload.chapters)
            _replace_transcript(connection, meeting_id, payload.transcript_text, payload.transcript_lines)
            _insert_action_items(connection, meeting_id, payload.action_items)
