import { Observable } from 'rxjs';
import { invokeHost$ } from './invoke';

/** What the host's call transcription is doing. It never carries transcript text. */
export type TranscriptionStatus = {
  available: boolean;
  enabled: boolean;
  listening: boolean;
  model: string | null;
  detail: string | null;
};

/** One transcribed stretch of the user's own microphone, as the host stored it. */
export type TranscriptChunk = {
  atMs: number;
  callStartedAtMs: number;
  appId: string;
  model: string;
  language: string | null;
  text: string;
};

export type TauriTranscription = {
  status$(): Observable<TranscriptionStatus>;
  day$(day: string): Observable<TranscriptChunk[]>;
};

export const createTauriTranscription = (): TauriTranscription => ({
  status$: () => invokeHost$<TranscriptionStatus>('transcription_status'),
  day$: (day) => invokeHost$<TranscriptChunk[]>('transcript_day', { day }),
});
