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

export type TauriTranscription = {
  status$(): Observable<TranscriptionStatus>;
};

export const createTauriTranscription = (): TauriTranscription => ({
  status$: () => invokeHost$<TranscriptionStatus>('transcription_status'),
});
