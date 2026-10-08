import { Provider, untracked } from '@angular/core';
import { provideUnsavedChangesConfirm } from '@ethlete/core';
import { createAlertDialogOpener } from '../overlay/alert-dialog/alert-dialog-opener';
import { injectUnsavedChangesLabels } from './unsaved-changes-labels';

/**
 * Makes every unsaved-changes tracker and guard below this injector that has no `confirm` of its own ask
 * through a destructive confirm dialog worded by `UNSAVED_CHANGES_LABELS`. The labels resolve in the
 * injector that holds this provider.
 *
 * @example
 * bootstrapApplication(AppComponent, { providers: [provideUnsavedChangesAlertDialog()] });
 */
export const provideUnsavedChangesAlertDialog = (): Provider =>
  provideUnsavedChangesConfirm(() => {
    const dialogs = createAlertDialogOpener();
    const labels = injectUnsavedChangesLabels();

    return () => {
      const { title, message, discard, keepEditing } = untracked(labels);

      return dialogs.confirm({ title, message, confirmLabel: discard, cancelLabel: keepEditing, destructive: true });
    };
  });
