import { describe, expect, it } from 'vitest';
import { parseTimetrackSettings } from './parse';
import {
  PREFERRED_TRANSCRIBE_LANGUAGES,
  TRANSCRIBE_LANGUAGES,
  TranscriptionStatusInput,
  migrateTranscribeLanguage,
  transcriptionPhase,
} from './transcription';

const status = (change: Partial<TranscriptionStatusInput> = {}): TranscriptionStatusInput => ({
  available: true,
  enabled: true,
  listening: false,
  transcribing: false,
  detail: null,
  error: null,
  ...change,
});

describe('migrateTranscribeLanguage', () => {
  it('keeps a stored code the engine knows', () => {
    expect(migrateTranscribeLanguage('fr')).toBe('fr');
    expect(migrateTranscribeLanguage('yue')).toBe('yue');
    expect(migrateTranscribeLanguage('auto')).toBe('auto');
  });

  it('falls back to German for free text an older input let through', () => {
    expect(migrateTranscribeLanguage('Deutsch')).toBe('de');
    expect(migrateTranscribeLanguage('EN')).toBe('de');
    expect(migrateTranscribeLanguage('xx')).toBe('de');
    expect(migrateTranscribeLanguage('')).toBe('de');
    expect(migrateTranscribeLanguage(7)).toBe('de');
    expect(migrateTranscribeLanguage(undefined)).toBe('de');
  });

  it('is what the settings document is read through', () => {
    expect(parseTimetrackSettings({ transcribeLanguage: 'pl' }).transcribeLanguage).toBe('pl');
    expect(parseTimetrackSettings({ transcribeLanguage: 'polish' }).transcribeLanguage).toBe('de');
  });

  it('offers each language once, with the short list first', () => {
    expect(new Set(TRANSCRIBE_LANGUAGES).size).toBe(TRANSCRIBE_LANGUAGES.length);
    expect(TRANSCRIBE_LANGUAGES.slice(1, 1 + PREFERRED_TRANSCRIBE_LANGUAGES.length)).toEqual(
      PREFERRED_TRANSCRIBE_LANGUAGES,
    );
  });
});

describe('transcriptionPhase', () => {
  it('is unavailable in a build without the engine, whatever else is set', () => {
    expect(transcriptionPhase(status({ available: false, enabled: true, listening: true }))).toBe('unavailable');
  });

  it('is off when the user has not turned it on', () => {
    expect(transcriptionPhase(status({ enabled: false }))).toBe('off');
  });

  it('is idle while enabled and no call is being listened to', () => {
    expect(transcriptionPhase(status())).toBe('idle');
  });

  it('is loading while the model is being fetched', () => {
    expect(transcriptionPhase(status({ detail: 'loading the model' }))).toBe('loading');
  });

  it('is listening on a call, and transcribing while a chunk is being worked on', () => {
    expect(transcriptionPhase(status({ listening: true }))).toBe('listening');
    expect(transcriptionPhase(status({ listening: true, transcribing: true }))).toBe('transcribing');
  });

  it('is an error once a listener ended with one, but not while it still listens', () => {
    expect(transcriptionPhase(status({ error: 'whisper: failed' }))).toBe('error');
    expect(transcriptionPhase(status({ error: 'whisper: failed', listening: true }))).toBe('listening');
  });
});
