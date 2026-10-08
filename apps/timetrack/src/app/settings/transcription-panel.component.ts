import { Component, ViewEncapsulation, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BADGE_IMPORTS, FORM_FIELD_IMPORTS, SELECT_IMPORTS, SWITCH_IMPORTS } from '@ethlete/components';
import {
  AUTO_TRANSCRIBE_LANGUAGE,
  PREFERRED_TRANSCRIBE_LANGUAGES,
  TRANSCRIBE_LANGUAGES,
  TranscriptionPhase,
  migrateTranscribeLanguage,
  transcriptionPhase,
} from '@ethlete/timetrack';
import { catchError, of, switchMap, timer } from 'rxjs';
import { injectHostPorts } from '../../host';
import { formatClockTime } from '../display';
import { ExplainComponent } from './explain.component';
import { injectTimetrackSettings } from './settings';

const WHY = `During a call, your own microphone is transcribed on this machine, 30 seconds at a
time. The audio stays in memory and is dropped once its text is written to the encrypted database; the other
participants are never recorded. Nothing is sent anywhere, and transcripts older than seven days are deleted.

The text is used by agents that ask for a day's transcript. It does not name or move a row by itself.`;

const PHASES: Record<TranscriptionPhase, { label: string; color: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  unavailable: { label: 'Not in this build', color: 'neutral' },
  off: { label: 'Off', color: 'neutral' },
  idle: { label: 'Idle, waiting for a call', color: 'neutral' },
  loading: { label: 'Loading the model', color: 'warning' },
  listening: { label: 'Listening', color: 'success' },
  transcribing: { label: 'Transcribing', color: 'success' },
  error: { label: 'Error', color: 'danger' },
};

const RECENT = 3;
const EXCERPT = 160;

const calendarDayOf = (at: Date) =>
  [at.getFullYear(), at.getMonth() + 1, at.getDate()].map((part) => String(part).padStart(2, '0')).join('-');

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

const labelOf = (code: string) =>
  code === AUTO_TRANSCRIBE_LANGUAGE ? 'Detect per chunk' : (languageNames.of(code) ?? code);

const OPTIONS = (() => {
  const preferred = new Set<string>([AUTO_TRANSCRIBE_LANGUAGE, ...PREFERRED_TRANSCRIBE_LANGUAGES]);
  const rest = TRANSCRIBE_LANGUAGES.filter((code) => !preferred.has(code))
    .map((code) => ({ value: code, label: labelOf(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [
    ...[AUTO_TRANSCRIBE_LANGUAGE, ...PREFERRED_TRANSCRIBE_LANGUAGES].map((code) => ({
      value: code,
      label: labelOf(code),
    })),
    ...rest,
  ];
})();

const clock = (atMs: number) => formatClockTime(new Date(atMs), { seconds: true });

@Component({
  selector: 'ethlete-transcription-panel',
  template: `
    @if (status()?.available) {
      <div class="flex flex-col gap-3" data-transcription>
        <div class="flex items-center gap-2">
          <h3 class="text-h4">Transcribe my microphone on calls</h3>
          <et-switch
            [checked]="store.settings().transcribeCalls"
            (checkedChange)="store.setTranscribeCalls($event)"
            aria-label="Transcribe my own microphone during calls"
          />
          <ethlete-explain [text]="WHY" label="call transcription" />
        </div>

        @if (store.settings().transcribeCalls) {
          <et-form-field class="w-56" appearance="underline" size="sm">
            <et-label>Language</et-label>
            <et-select [value]="store.settings().transcribeLanguage" (valueChange)="setLanguage($event)">
              @for (option of OPTIONS; track option.value) {
                <et-select-option [value]="option.value" [label]="option.label">
                  {{ option.label }}
                </et-select-option>
              }
            </et-select>
          </et-form-field>
        }

        <div class="flex flex-wrap items-center gap-2">
          <et-badge [color]="phase().color" size="sm" data-transcription-phase>{{ phase().label }}</et-badge>

          @if (status()?.model; as model) {
            <span class="text-small text-et-surface-subtle">{{ model }}</span>
          }
        </div>

        @if (status()?.error; as error) {
          <p class="text-small text-et-error" data-transcription-error>Last error: {{ error }}</p>
        }

        @if (store.settings().transcribeCalls) {
          <div class="flex flex-col gap-2" data-transcription-recent>
            @if (status()?.lastTranscribedAtMs; as at) {
              <p class="text-small" data-transcription-last>
                Last transcribed at {{ CLOCK(at) }}, {{ seconds(status()?.lastDurationMs ?? 0) }} s of work,
                {{ status()?.chunksStored }} chunk{{ status()?.chunksStored === 1 ? '' : 's' }} since the app started.
              </p>
            }

            @for (chunk of recent(); track chunk.atMs) {
              <div class="rounded-md border border-et-surface-border p-3" data-transcription-chunk>
                <div class="text-small text-et-surface-subtle">
                  {{ CLOCK(chunk.atMs) }} · {{ chunk.appId }} · {{ chunk.language ?? 'unknown language' }}
                </div>
                <p class="text-small">{{ excerpt(chunk.text) }}</p>
              </div>
            } @empty {
              <p class="text-small text-et-surface-subtle">Nothing transcribed today.</p>
            }
          </div>
        }
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SWITCH_IMPORTS, SELECT_IMPORTS, FORM_FIELD_IMPORTS, BADGE_IMPORTS, ExplainComponent],
})
export class TranscriptionPanelComponent {
  protected store = injectTimetrackSettings();
  private ports = injectHostPorts();

  protected readonly WHY = WHY;
  protected readonly OPTIONS = OPTIONS;
  protected readonly CLOCK = clock;

  protected status = toSignal(
    timer(0, 5_000).pipe(switchMap(() => this.ports.transcription.status$().pipe(catchError(() => of(null))))),
    { initialValue: null },
  );

  private chunks = toSignal(
    timer(0, 5_000).pipe(
      switchMap(() => this.ports.transcription.day$(calendarDayOf(new Date())).pipe(catchError(() => of([])))),
    ),
    { initialValue: [] },
  );

  protected recent = computed(() => this.chunks().slice(-RECENT).reverse());

  protected phase = computed(() => {
    const status = this.status();

    return PHASES[status ? transcriptionPhase(status) : 'unavailable'];
  });

  protected seconds(ms: number) {
    return (ms / 1000).toFixed(1);
  }

  protected excerpt(text: string) {
    return text.length > EXCERPT ? `${text.slice(0, EXCERPT).trimEnd()}…` : text;
  }

  protected setLanguage(value: unknown) {
    this.store.setTranscribeLanguage(migrateTranscribeLanguage(value));
  }
}
