from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class TranscriptLineBase(BaseModel):
    speaker_name: str
    speaker_label: str
    start_second: int = Field(ge=0)
    end_second: int = Field(ge=0)
    text: str
    line_order: int = Field(ge=0)


class TranscriptLineCreate(TranscriptLineBase):
    pass


class TranscriptLineRead(TranscriptLineBase):
    id: int


class ActionItemBase(BaseModel):
    title: str
    description: str | None = None
    assignee_name: str | None = None
    due_date: date | None = None
    is_completed: bool = False


class ActionItemCreate(ActionItemBase):
    pass


class ActionItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee_name: str | None = None
    due_date: date | None = None
    is_completed: bool | None = None


class ActionItemRead(ActionItemBase):
    id: int


class MeetingParticipant(BaseModel):
    name: str


class MeetingBase(BaseModel):
    title: str
    meeting_date: date
    duration_seconds: int = Field(ge=0)
    participants: list[str] = Field(default_factory=list)
    source_type: str = "manual"
    source_filename: str | None = None


class MeetingCreate(MeetingBase):
    transcript_text: str | None = None
    transcript_lines: list[TranscriptLineCreate] = Field(default_factory=list)
    summary_text: str | None = None
    action_items: list[ActionItemCreate] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)


class MeetingUpdate(BaseModel):
    title: str | None = None
    meeting_date: date | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    participants: list[str] | None = None
    source_type: str | None = None
    source_filename: str | None = None
    transcript_text: str | None = None
    transcript_lines: list[TranscriptLineCreate] | None = None
    summary_text: str | None = None
    topics: list[str] | None = None


class MeetingListItem(MeetingBase):
    id: int


class MeetingDetail(MeetingBase):
    id: int
    transcript_text: str | None = None
    transcript_lines: list[TranscriptLineRead] = Field(default_factory=list)
    summary_text: str | None = None
    action_items: list[ActionItemRead] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)


class MeetingListResponse(BaseModel):
    items: list[MeetingListItem]


class CreateMeetingResponse(BaseModel):
    meeting: MeetingDetail


class UpdateMeetingResponse(BaseModel):
    meeting: MeetingDetail


class DeleteResponse(BaseModel):
    success: bool = True
    message: str
