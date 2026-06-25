from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query

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
)

router = APIRouter()


@router.get("/meetings", response_model=list[MeetingListItem])
def read_meetings(
    query: str | None = Query(default=None, description="Search by meeting title or participant"),
    participant: str | None = Query(default=None, description="Filter by participant name"),
    meeting_date: date | None = Query(default=None, description="Filter by meeting date"),
    sort: str = Query(default="recent", pattern="^(recent|oldest)$"),
) -> list[MeetingListItem]:
    return list_meetings(query=query, participant=participant, meeting_date=meeting_date, sort=sort)


@router.get("/meetings/{meeting_id}", response_model=MeetingDetail)
def read_meeting(meeting_id: int) -> MeetingDetail:
    meeting = get_meeting(meeting_id)
    if meeting is None:
        from fastapi import HTTPException

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
