import { Observable, defer, finalize, map, tap } from 'rxjs';
import { defineOverlay } from '../overlay-definition';
import { createOverlayOpener } from '../overlay-opener';
import { dialogOverlayStrategy } from '../strategies/dialog.strategy';
import { ALERT_DIALOG_CONTENT, AlertDialogComponent, AlertDialogContent } from './alert-dialog.component';

export type AlertDialogConfig = {
  /** The dialog's heading, and its accessible name. */
  title: string;
  /** Body text, announced as the dialog's description. Line breaks are kept. */
  message?: string;
  /** Overrides `ALERT_DIALOG_LABELS.acknowledge` for this dialog. */
  acknowledgeLabel?: string;
  /** The element or event the dialog was opened from. Defaults to the focused element. */
  origin?: HTMLElement | Event;
};

export type ConfirmDialogConfig = Omit<AlertDialogConfig, 'acknowledgeLabel'> & {
  /** Overrides `ALERT_DIALOG_LABELS.confirm` for this dialog. Name the action ("Delete project"), not "OK". */
  confirmLabel?: string;
  /** Overrides `ALERT_DIALOG_LABELS.cancel` for this dialog. */
  cancelLabel?: string;
  /** Renders the confirm action in the app's `type: 'error'` color theme. */
  destructive?: boolean;
};

export type AlertDialogOpener = {
  /**
   * A cold observable: subscribing opens a confirm dialog, which emits `true` when the confirm action is
   * pressed and `false` on cancel or <kbd>Escape</kbd>, then completes. Unsubscribing early closes the dialog.
   */
  confirm: (config: ConfirmDialogConfig) => Observable<boolean>;
  /**
   * A cold observable: subscribing opens an alert dialog, which emits once when it is acknowledged or
   * dismissed with <kbd>Escape</kbd>, then completes. Unsubscribing early closes the dialog.
   */
  alert: (config: AlertDialogConfig) => Observable<void>;
};

const alertDialogOverlay = /* @__PURE__ */ defineOverlay<AlertDialogComponent, boolean>({
  component: AlertDialogComponent,
  strategies: /* @__PURE__ */ dialogOverlayStrategy({ width: 'min(420px, 80%)' }),
  role: 'alertdialog',
  closeOnOutsidePointer: false,
  autoFocus: '[data-et-alert-dialog-initial-focus]',
});

let nextMessageId = 0;

/**
 * Creates an opener for confirm and alert dialogs (`role="alertdialog"`). Must be called in an injection context.
 * Initial focus lands on the least destructive action, a press outside the dialog does nothing, and the action
 * labels come from `ALERT_DIALOG_LABELS` unless the call overrides them.
 *
 * @example
 * private dialogs = createAlertDialogOpener();
 *
 * protected deleteProject() {
 *   this.dialogs
 *     .confirm({ title: 'Delete project?', confirmLabel: 'Delete', destructive: true })
 *     .pipe(filter(Boolean), switchMap(() => this.api.deleteProject()))
 *     .subscribe();
 * }
 */
export const createAlertDialogOpener = (): AlertDialogOpener => {
  const opener = createOverlayOpener(alertDialogOverlay);

  const open = (content: Omit<AlertDialogContent, 'messageId'>, origin: HTMLElement | Event | undefined) =>
    defer(() => {
      const messageId = `et-alert-dialog-message-${nextMessageId++}`;
      let settled = false;

      const ref = opener.open({
        origin,
        ariaDescribedBy: content.message ? messageId : null,
        providers: [{ provide: ALERT_DIALOG_CONTENT, useValue: { ...content, messageId } }],
      });

      return ref.afterClosed().pipe(
        tap(() => (settled = true)),
        map((result) => result === true),
        finalize(() => {
          if (!settled) ref.close();
        }),
      );
    });

  return {
    confirm: (config) =>
      open(
        {
          kind: 'confirm',
          title: config.title,
          message: config.message ?? null,
          confirmLabel: config.confirmLabel ?? null,
          cancelLabel: config.cancelLabel ?? null,
          acknowledgeLabel: null,
          destructive: config.destructive ?? false,
        },
        config.origin,
      ),
    alert: (config) =>
      open(
        {
          kind: 'alert',
          title: config.title,
          message: config.message ?? null,
          confirmLabel: null,
          cancelLabel: null,
          acknowledgeLabel: config.acknowledgeLabel ?? null,
          destructive: false,
        },
        config.origin,
      ).pipe(map((): void => undefined)),
  };
};
