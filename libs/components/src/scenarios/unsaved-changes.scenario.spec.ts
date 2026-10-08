import { signal } from '@angular/core';
import {
  ColorTheme,
  createUnsavedChangesTracker,
  injectUnsavedChangesCoordinator,
  provideColorThemesWithTailwind4,
  ThemeSwatch,
} from '@ethlete/core';
import {
  DEFAULT_UNSAVED_CHANGES_LABELS,
  injectUnsavedChangesLabels,
  provideOverlay,
  provideUnsavedChangesAlertDialog,
  provideUnsavedChangesLabels,
  UNSAVED_CHANGES_LABELS,
} from '../index';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alarm', type: 'error', primary: swatch('200 30 30') },
];

const dialogs = () => document.querySelectorAll('.et-overlay-runtime-entry[role="alertdialog"]');

const button = (label: string) => {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>('.et-alert-dialog-actions button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );

  if (!match) throw new Error(`no "${label}" button`);

  return match;
};

describe('unsaved-changes alert dialog scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideColorThemesWithTailwind4(COLOR_THEMES),
      provideOverlay(),
      provideUnsavedChangesAlertDialog(),
      provideUnsavedChangesLabels({ title: 'Änderungen verwerfen?' }),
    ],
  });

  it('asks through a destructive confirm dialog worded by the labels when the guard has no confirm', async () => {
    const s = scenario();
    const model = signal({ name: 'Ada' });
    const c = s.consumer();
    const tracker = c.run(() => createUnsavedChangesTracker({ source: model, tab: false }));

    model.set({ name: 'Grace' });
    s.tick();

    const check = tracker.runCheck();
    s.flush();

    expect(dialogs()).toHaveLength(1);
    expect(document.querySelector('.et-alert-dialog-title')?.textContent?.trim()).toBe('Änderungen verwerfen?');
    expect(document.activeElement?.textContent?.trim()).toBe(DEFAULT_UNSAVED_CHANGES_LABELS.keepEditing);

    button(DEFAULT_UNSAVED_CHANGES_LABELS.discard).click();
    s.flush();

    await expect(check).resolves.toBe(true);
    s.flush();
    expect(dialogs()).toHaveLength(0);

    c.destroy();
  });

  it('closes the dialog by itself when the session ends while it is open', async () => {
    const s = scenario();
    const model = signal({ name: 'Ada' });
    const c = s.consumer();
    const tracker = c.run(() => createUnsavedChangesTracker({ source: model, tab: false }));

    model.set({ name: 'Grace' });
    s.tick();

    const check = tracker.runCheck();
    s.flush();
    expect(dialogs()).toHaveLength(1);

    s.run(() => injectUnsavedChangesCoordinator()).abandonAll('logout');
    s.flush();

    await expect(check).resolves.toBe(true);
    s.flush();
    expect(dialogs()).toHaveLength(0);

    c.destroy();
  });

  it('exposes the labels in effect as a signal', () => {
    const s = scenario();
    const local = s.consumer([{ provide: UNSAVED_CHANGES_LABELS, useValue: { discard: 'Verwerfen' } }]);

    expect(s.run(() => injectUnsavedChangesLabels())().title).toBe('Änderungen verwerfen?');
    expect(local.run(() => injectUnsavedChangesLabels())().discard).toBe('Verwerfen');

    local.destroy();
  });
});
