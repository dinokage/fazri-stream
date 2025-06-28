export interface TranscriptionResult {
  text: string;
  confidence: number;
  language?: string;
  processingTime?: number;
  wordCount?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  utterances?: Array<{
    start: number;
    end: number;
    confidence: number;
    channel: number;
    transcript: string;
    words: Array<{
      word: string;
      start: number;
      end: number;
      confidence: number;
    }>;
  }>;
}

export interface TranscriptionResponse {
  success: boolean;
  result?: TranscriptionResult;
  error?: string;
  fromCache?: boolean;
  processingTime?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface AsyncJobResponse {
  success: boolean;
  jobId?: string;
  message?: string;
  estimatedTime?: number;
  error?: string;
}

export interface AsyncJobStatus {
  success: boolean;
  jobId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  result?: TranscriptionResult;
  error?: string;
  progress?: number;
}

export interface CaptionFormat {
  format: 'webvtt' | 'srt';
  content: string;
  filename: string;
  mimeType: string;
}