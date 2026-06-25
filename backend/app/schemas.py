from pydantic import BaseModel, Field


class ApiResponse(BaseModel):
    success: bool = True
    message: str | None = None


class MeetingBase(BaseModel):
    title: str
    meeting_date: str
    duration_seconds: int = Field(ge=0)


class MeetingListItem(MeetingBase):
    id: int
    participants: list[str] = []


class MeetingDetail(MeetingListItem):
    summary: str | None = None
    action_items: list[str] = []
    topics: list[str] = []
