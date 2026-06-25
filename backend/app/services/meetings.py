from __future__ import annotations

import sqlite3
from datetime import date
from typing import Any

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
)


def bootstrap_database() -> None:
    initialize_database()
    seed_database()


def _row_to_meeting_list_item(row: sqlite3.Row) -> MeetingListItem:
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
    )


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
        summary_text=summary_row["summary_text"] if summary_row else None,
        action_items=action_items,
        topics=topics,
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
            )
            """
        )
        like = f"%{query.lower()}%"
        params.extend([like, like])

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
        return [_row_to_meeting_list_item(row) for row in rows]


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
        connection.execute(
            "INSERT INTO meeting_participants (meeting_id, name, role) VALUES (?, ?, ?)",
            (meeting_id, name, None),
        )


def _replace_topics(connection: sqlite3.Connection, meeting_id: int, topics: list[str]) -> None:
    connection.execute("DELETE FROM topics WHERE meeting_id = ?", (meeting_id,))
    for sort_order, topic in enumerate(topics):
        connection.execute(
            "INSERT INTO topics (meeting_id, name, sort_order) VALUES (?, ?, ?)",
            (meeting_id, topic, sort_order),
        )


def _replace_summary(connection: sqlite3.Connection, meeting_id: int, summary_text: str | None) -> None:
    connection.execute("DELETE FROM summaries WHERE meeting_id = ?", (meeting_id,))
    if summary_text:
        connection.execute(
            "INSERT INTO summaries (meeting_id, summary_text, created_by) VALUES (?, ?, ?)",
            (meeting_id, summary_text, "system"),
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
        _replace_summary(connection, meeting_id, payload.summary_text)
        _replace_topics(connection, meeting_id, payload.topics)
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
        if payload.summary_text is not None:
            _replace_summary(connection, meeting_id, payload.summary_text)
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
            params.append(payload.due_date.isoformat())
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
        due_date=updated["due_date"],
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
                ],
                summary_text="The team aligned on launch readiness, timeline risks, and the final marketing checklist.",
                action_items=[
                    ActionItemCreate(title="Finalize landing page copy", assignee_name="Meera"),
                    ActionItemCreate(title="Confirm launch owner", assignee_name="Aditi"),
                ],
                topics=["Launch", "Timeline", "Marketing"],
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
                action_items=[
                    ActionItemCreate(title="Refine onboarding flow", assignee_name="Nisha"),
                    ActionItemCreate(title="Collect customer feedback", assignee_name="Karan"),
                ],
                topics=["Product", "UX", "Sprint"],
            ),
            MeetingCreate(
                title="Customer Escalation Review",
                meeting_date=date(2026, 6, 21),
                duration_seconds=2940,
                participants=["Priya", "Dev", "Sana"],
                source_type="seeded",
                source_filename="customer-escalation.json",
                transcript_text="Support and engineering reviewed an escalated enterprise customer issue.",
                transcript_lines=[
                    TranscriptLineCreate(
                        speaker_name="Priya",
                        speaker_label="PR",
                        start_second=12,
                        end_second=24,
                        text="The customer expects a root cause summary today.",
                        line_order=0,
                    ),
                    TranscriptLineCreate(
                        speaker_name="Dev",
                        speaker_label="DV",
                        start_second=28,
                        end_second=41,
                        text="We reproduced the issue and are verifying the patch.",
                        line_order=1,
                    ),
                ],
                summary_text="The group confirmed the issue, agreed on a patch path, and set a customer follow-up plan.",
                action_items=[
                    ActionItemCreate(title="Draft RCA summary", assignee_name="Dev"),
                    ActionItemCreate(title="Send customer update", assignee_name="Priya"),
                ],
                topics=["Support", "Escalation", "Engineering"],
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
            _replace_summary(connection, meeting_id, payload.summary_text)
            _replace_topics(connection, meeting_id, payload.topics)
            _replace_transcript(connection, meeting_id, payload.transcript_text, payload.transcript_lines)
            _insert_action_items(connection, meeting_id, payload.action_items)
