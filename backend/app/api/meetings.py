from fastapi import APIRouter

from app.schemas import MeetingDetail, MeetingListItem

router = APIRouter()

_sample_meeting = MeetingDetail(
    id=1,
    title="Q2 Launch Review",
    meeting_date="2026-06-24",
    duration_seconds=2520,
    participants=["Aditi", "Rahul", "Meera"],
    summary="The team aligned on launch readiness, timeline risks, and final checklist items.",
    action_items=["Finalize landing page copy", "Confirm launch owner"],
    topics=["Launch", "Timeline", "Marketing"],
)


@router.get("/meetings", response_model=list[MeetingListItem])
def list_meetings() -> list[MeetingListItem]:
    return [
        MeetingListItem(
            id=_sample_meeting.id,
            title=_sample_meeting.title,
            meeting_date=_sample_meeting.meeting_date,
            duration_seconds=_sample_meeting.duration_seconds,
            participants=_sample_meeting.participants,
        )
    ]


@router.get("/meetings/{meeting_id}", response_model=MeetingDetail)
def get_meeting(meeting_id: int) -> MeetingDetail:
    return _sample_meeting.model_copy(update={"id": meeting_id})
