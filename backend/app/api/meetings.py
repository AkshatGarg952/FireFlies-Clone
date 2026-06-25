from __future__ import annotations

from datetime import date
from fastapi import APIRouter, Query, File, UploadFile, HTTPException

from app.schemas import (
    ActionItemCreate,
    ActionItemRead,
    ActionItemUpdate,
    CreateMeetingResponse,
    DeleteResponse,
    MeetingCreate,
    MeetingDetail,
    MeetingListItem,
    MeetingUpdate,
    UpdateMeetingResponse,
    CommentCreate,
    CommentRead,
    CommentUpdate,
    SoundbiteCreate,
    SoundbiteRead,
)
from app.services.meetings import (
    add_action_item,
    create_meeting,
    delete_action_item,
    delete_meeting,
    get_meeting,
    list_meetings,
    update_action_item,
    update_meeting,
    parse_and_create_uploaded_meeting,
    add_comment,
    update_comment,
    delete_comment,
    toggle_highlight,
    add_soundbite,
    delete_soundbite,
    get_analytics,
    ask_meeting_question,
)

router = APIRouter()


@router.get("/meetings", response_model=list[MeetingListItem])
def read_meetings(
    query: str | None = Query(default=None, description="Search by meeting title, participant, or transcript"),
    participant: str | None = Query(default=None, description="Filter by participant name"),
    meeting_date: date | None = Query(default=None, description="Filter by meeting date"),
    sort: str = Query(default="recent", pattern="^(recent|oldest)$"),
) -> list[MeetingListItem]:
    return list_meetings(query=query, participant=participant, meeting_date=meeting_date, sort=sort)


@router.get("/meetings/{meeting_id}", response_model=MeetingDetail)
def read_meeting(meeting_id: int) -> MeetingDetail:
    meeting = get_meeting(meeting_id)
    if meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("/meetings", response_model=CreateMeetingResponse, status_code=201)
def create_meeting_endpoint(payload: MeetingCreate) -> CreateMeetingResponse:
    meeting = create_meeting(payload)
    return CreateMeetingResponse(meeting=meeting)


@router.patch("/meetings/{meeting_id}", response_model=UpdateMeetingResponse)
def update_meeting_endpoint(meeting_id: int, payload: MeetingUpdate) -> UpdateMeetingResponse:
    meeting = update_meeting(meeting_id, payload)
    return UpdateMeetingResponse(meeting=meeting)


@router.delete("/meetings/{meeting_id}", response_model=DeleteResponse)
def delete_meeting_endpoint(meeting_id: int) -> DeleteResponse:
    delete_meeting(meeting_id)
    return DeleteResponse(message="Meeting deleted successfully")


# --- UPLOAD MEETING TRANSCRIPT ---
@router.post("/meetings/upload", response_model=CreateMeetingResponse, status_code=201)
async def upload_meeting_file(file: UploadFile = File(...)) -> CreateMeetingResponse:
    content = await file.read()
    try:
        text_content = content.decode("utf-8")
    except Exception:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid UTF-8 text file.")

    meeting = parse_and_create_uploaded_meeting(file.filename, text_content)
    return CreateMeetingResponse(meeting=meeting)


# --- COMMENTS ENDPOINTS ---
@router.post("/meetings/{meeting_id}/comments", response_model=CommentRead, status_code=201)
def add_comment_endpoint(meeting_id: int, payload: CommentCreate) -> CommentRead:
    return add_comment(meeting_id, payload)


@router.patch("/comments/{comment_id}", response_model=CommentRead)
def update_comment_endpoint(comment_id: int, payload: CommentUpdate) -> CommentRead:
    return update_comment(comment_id, payload.text)


@router.delete("/comments/{comment_id}", response_model=DeleteResponse)
def delete_comment_endpoint(comment_id: int) -> DeleteResponse:
    delete_comment(comment_id)
    return DeleteResponse(message="Comment deleted successfully")


# --- HIGHLIGHTS ENDPOINTS ---
@router.post("/meetings/{meeting_id}/highlights/toggle")
def toggle_highlight_endpoint(meeting_id: int, transcript_line_id: int = Query(...)) -> dict:
    is_highlighted = toggle_highlight(meeting_id, transcript_line_id)
    return {"highlighted": is_highlighted}


# --- SOUNDBITES ENDPOINTS ---
@router.post("/meetings/{meeting_id}/soundbites", response_model=SoundbiteRead, status_code=201)
def add_soundbite_endpoint(meeting_id: int, payload: SoundbiteCreate) -> SoundbiteRead:
    return add_soundbite(meeting_id, payload)


@router.delete("/soundbites/{soundbite_id}", response_model=DeleteResponse)
def delete_soundbite_endpoint(soundbite_id: int) -> DeleteResponse:
    delete_soundbite(soundbite_id)
    return DeleteResponse(message="Soundbite deleted successfully")


# --- ANALYTICS ENDPOINTS ---
@router.get("/meetings/{meeting_id}/analytics")
def get_meeting_analytics(meeting_id: int) -> dict:
    return get_analytics(meeting_id)


# --- ASK ASSISTANT Q&A ENDPOINT ---
@router.post("/meetings/{meeting_id}/ask")
def ask_meeting_question_endpoint(meeting_id: int, payload: dict) -> dict:
    question = payload.get("question")
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    answer = ask_meeting_question(meeting_id, question)
    return {"answer": answer}


# --- ACTION ITEMS ENDPOINTS ---
@router.post("/meetings/{meeting_id}/action-items", response_model=ActionItemRead, status_code=201)
def add_action_item_endpoint(meeting_id: int, payload: ActionItemCreate) -> ActionItemRead:
    return add_action_item(meeting_id, payload)


@router.patch("/action-items/{action_item_id}", response_model=ActionItemRead)
def update_action_item_endpoint(action_item_id: int, payload: ActionItemUpdate) -> ActionItemRead:
    return update_action_item(action_item_id, payload)


@router.delete("/action-items/{action_item_id}", response_model=DeleteResponse)
def delete_action_item_endpoint(action_item_id: int) -> DeleteResponse:
    delete_action_item(action_item_id)
    return DeleteResponse(message="Action item deleted successfully")
