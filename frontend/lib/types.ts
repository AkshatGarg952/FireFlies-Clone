export type TranscriptLine = {
  id: string;
  speaker: string;
  timestamp: string;
  startSecond: number;
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
  summaryBullets: string[];
  actionItems: Array<{
    id: string;
    title: string;
    assignee?: string;
    completed: boolean;
  }>;
  topics: string[];
  tags: string[];
  chapters: Array<{
    label: string;
    time: string;
  }>;
  transcript: TranscriptLine[];
  durationSeconds: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};
