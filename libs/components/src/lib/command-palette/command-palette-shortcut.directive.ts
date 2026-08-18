import { DOCUMENT, DestroyRef, Directive, afterNextRender, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RuntimeError } from '@ethlete/core';
import { filter, fromEvent, take, tap } from 'rxjs';
import { KBD_PLATFORM, matchesKbdChord, parseKbdKeys } from '../kbd';
import { OverlayRef } from '../overlay';
import { CommandPaletteComponent } from './command-palette.component';
import { COMMAND_PALETTE_ERROR_CODES } from './command-palette-errors';
import { injectCommandPalette } from './command-palette.overlay';

const MODIFIERS = /* @__PURE__ */ new Set([
  'mod',
  'meta',
  'ctrl',
  'alt',
  'shift',
  'cmd',
  'command',
  'control',
  'option',
]);

const DEFAULT_SHORTCUT = 'mod+k';

/**
 * Opens the command palette on a key chord, for as long as the host element lives, and closes it again
 * on the same chord. Put it on the application's root component; the chord is listened for on the
 * document, not on the host element.
 *
 * Opt-in on purpose: nothing in this library takes a global key without being asked. `mod` resolves to
 * Command on Apple platforms and Control everywhere else, so one chord suits both.
 *
 * @example
 * <div etCommandPaletteShortcut>…</div>
 *
 * @example
 * <div etCommandPaletteShortcut="mod+shift+p">…</div>
 */
@Directive({
  selector: '[etCommandPaletteShortcut]',
  exportAs: 'etCommandPaletteShortcut',
})
export class CommandPaletteShortcutDirective {
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  private platform = inject(KBD_PLATFORM);
  private palette = injectCommandPalette();

  /** The chord, in `et-kbd` syntax. */
  public shortcut = input(DEFAULT_SHORTCUT, {
    alias: 'etCommandPaletteShortcut',
    // A bare `etCommandPaletteShortcut` attribute binds the empty string, not the default, so without
    // this the documented no-value form would listen for a chord that can never fire.
    transform: (value: string) => value?.trim() || DEFAULT_SHORTCUT,
  });

  private openRef: OverlayRef<CommandPaletteComponent> | null = null;

  constructor() {
    if (ngDevMode) {
      // After the first render, so the chord checked is the one the consumer wrote and not the default.
      afterNextRender(() => {
        const keys = parseKbdKeys(this.shortcut());

        if (!keys.some((key) => !MODIFIERS.has(key.toLowerCase()))) {
          throw new RuntimeError(
            COMMAND_PALETTE_ERROR_CODES.SHORTCUT_WITHOUT_KEY,
            `[CommandPaletteShortcutDirective] "${this.shortcut()}" is modifiers only, so it can never fire. Add a key, e.g. "${DEFAULT_SHORTCUT}".`,
          );
        }
      });
    }

    fromEvent<KeyboardEvent>(this.document, 'keydown')
      .pipe(
        filter((event) => matchesKbdChord(event, { keys: this.shortcut(), platform: this.platform })),
        tap((event) => {
          event.preventDefault();
          this.toggle();
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  public toggle() {
    if (this.openRef) {
      this.openRef.close();

      return;
    }

    const ref = this.palette.open();

    this.openRef = ref;

    ref
      .afterClosed()
      .pipe(
        take(1),
        tap(() => (this.openRef = null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
