export type TranscriptLine = {
  id: string;
  speaker: string;
  timestamp: string;
  text: string;
};

export type MeetingPreview = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  participants: string[];
  summary: string;
  actionItems: string[];
  topics: string[];
  transcript: TranscriptLine[];
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};
