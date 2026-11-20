import { Binding, DestroyRef, DOCUMENT, inject, inputBinding, outputBinding, Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  dialogOverlayStrategy,
  injectOverlayManager,
  KBD_PLATFORM,
  matchesKbdChord,
  OverlayRef,
} from '@ethlete/components';
import { catchError, EMPTY, filter, fromEvent, Observable, of, tap } from 'rxjs';
import { openHelp$, studioVersion$ } from '../../../host/about';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { AboutDialogComponent } from '../about-dialog/about-dialog.component';
import { SHORTCUTS_KEY, ShortcutsDialogComponent } from '../shortcuts-dialog/shortcuts-dialog.component';

/** Opens the dialogs and the help page behind the Studio menu, and Tastenkürzel on Ctrl+/ / ⌘/. */
export const injectStudioMenuDialogs = () => {
  const overlay = injectOverlayManager();
  const platform = inject(KBD_PLATFORM);
  const destroyRef = inject(DestroyRef);
  let open: OverlayRef<object> | null = null;

  const show = <T extends object>(component: Type<T>, config: { ariaLabel: string; bindings?: Binding[] }) => {
    if (open) return;

    const ref: OverlayRef<object> = overlay.open(component, {
      role: 'dialog',
      ariaLabel: config.ariaLabel,
      strategies: dialogOverlayStrategy({ width: '40rem', maxWidth: 'calc(100% - var(--space-6))' }),
      bindings: [...(config.bindings ?? []), outputBinding('close', () => ref.close())],
    });

    open = ref;
    ref
      .afterClosed()
      .pipe(
        tap(() => {
          if (open === ref) open = null;
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  const run = <T>(work$: Observable<T>) =>
    work$
      .pipe(
        // eslint-disable-next-line ethlete/no-silent-catch-error -- a browser without the host opens nothing; the menu has no error slot
        catchError(() => EMPTY),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();

  const shortcuts = () => show(ShortcutsDialogComponent, { ariaLabel: STUDIO_LABELS.shortcutsDialog.title });

  const about = () =>
    run(
      studioVersion$().pipe(
        // eslint-disable-next-line ethlete/no-silent-catch-error -- without a host the dialog shows no version line
        catchError(() => of('')),
        tap((version) =>
          show(AboutDialogComponent, {
            ariaLabel: STUDIO_LABELS.aboutDialog.title,
            bindings: [inputBinding('version', () => version)],
          }),
        ),
      ),
    );

  const help = () => run(openHelp$());

  fromEvent<KeyboardEvent>(inject(DOCUMENT), 'keydown')
    .pipe(
      filter(
        (event) =>
          !event.repeat && !event.defaultPrevented && matchesKbdChord(event, { keys: SHORTCUTS_KEY, platform }),
      ),
      tap((event) => {
        event.preventDefault();
        shortcuts();
      }),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  return { shortcuts, about, help };
};
