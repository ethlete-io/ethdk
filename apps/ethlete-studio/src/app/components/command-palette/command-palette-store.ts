import { DOCUMENT, DestroyRef, Signal, computed, inject, inputBinding, outputBinding, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  KBD_PLATFORM,
  OverlayRef,
  dialogOverlayStrategy,
  injectOverlayManager,
  matchesKbdChord,
} from '@ethlete/components';
import { defineProvider, toInjectFn, toProvideFn } from '@ethlete/core';
import { filter, fromEvent, tap } from 'rxjs';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { CommandPaletteComponent, PaletteEntry } from './command-palette.component';

const SHORTCUT = 'mod+k';

const RECENT_LIMIT = 3;

const NO_ENTRIES = signal<PaletteEntry[]>([]);

/** Opens the command palette from the title search or Ctrl+K / ⌘K, and remembers the entries chosen last. */
export class CommandPaletteStore {
  private overlay = injectOverlayManager();
  private platform = inject(KBD_PLATFORM);

  private entries: Signal<PaletteEntry[]> = NO_ENTRIES;
  private chosen: ((entry: PaletteEntry) => void) | null = null;
  private field: (() => HTMLElement) | null = null;
  private ref: OverlayRef<CommandPaletteComponent> | null = null;
  private recentKeys = signal<string[]>([]);

  public recents = computed(() => {
    const entries = this.entries();

    return this.recentKeys().flatMap((key) => entries.find((entry) => keyOf(entry) === key) ?? []);
  });

  constructor() {
    fromEvent<KeyboardEvent>(inject(DOCUMENT), 'keydown')
      .pipe(
        filter(
          (event) =>
            !event.repeat &&
            !event.defaultPrevented &&
            matchesKbdChord(event, { keys: SHORTCUT, platform: this.platform }),
        ),
        tap((event) => {
          event.preventDefault();
          this.toggle();
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe();
  }

  public connect(entries: Signal<PaletteEntry[]>, choose: (entry: PaletteEntry) => void) {
    this.entries = entries;
    this.chosen = choose;
  }

  public attachField(field: () => HTMLElement) {
    this.field = field;
  }

  public detachField(field: () => HTMLElement) {
    if (this.field === field) this.field = null;
  }

  public toggle() {
    if (this.ref) this.ref.close();
    else this.open();
  }

  public open() {
    if (this.ref) return;

    const ref = this.overlay.open(CommandPaletteComponent, {
      strategies: dialogOverlayStrategy({
        width: 'var(--container-3xl)',
        maxWidth: 'calc(100% - var(--space-6))',
        containerClass: ['mt-16', 'self-start', 'rounded-control-lg', 'border-0', 'shadow-lg'],
        backdropClass: ['top-8', 'bg-et-surface-bg/60'],
      }),
      ariaLabel: STUDIO_LABELS.commandPalette.label,
      autoFocus: 'input',
      restoreFocus: false,
      bindings: [
        inputBinding('entries', this.entries),
        inputBinding('recents', this.recents),
        outputBinding<PaletteEntry>('choose', (entry) => this.choose(entry)),
      ],
    });

    this.ref = ref;

    ref
      .afterClosedEvent()
      .pipe(
        tap(({ source }) => {
          this.ref = null;

          if (source !== 'outside-pointer') this.field?.().focus();
        }),
      )
      .subscribe();
  }

  private choose(entry: PaletteEntry) {
    this.recentKeys.update((keys) =>
      [keyOf(entry), ...keys.filter((key) => key !== keyOf(entry))].slice(0, RECENT_LIMIT),
    );
    this.chosen?.(entry);
  }
}

const keyOf = (entry: PaletteEntry) => `${entry.kind}:${entry.key}`;

const COMMAND_PALETTE_STORE_DEF = /* @__PURE__ */ defineProvider(() => new CommandPaletteStore());

export const provideCommandPaletteStore = /* @__PURE__ */ toProvideFn(COMMAND_PALETTE_STORE_DEF);

export const injectCommandPaletteStore = /* @__PURE__ */ toInjectFn(COMMAND_PALETTE_STORE_DEF);
