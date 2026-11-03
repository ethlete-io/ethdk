import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { CommentDraftComponent, CommentSendPhase, draftKeyOf } from './comment-draft.component';

const render = async (text: string, phase: CommentSendPhase | null = null, reason = '') => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(CommentDraftComponent);

  fixture.componentRef.setInput('text', text);
  fixture.componentRef.setInput('phase', phase);
  fixture.componentRef.setInput('reason', reason);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const buttons = [...element.querySelectorAll<HTMLButtonElement>('button')];
  const button = (label: string) => buttons.find((candidate) => candidate.textContent?.trim() === label);

  return { fixture, element, button };
};

describe('CommentDraftComponent', () => {
  it('sends the typed text and cancels through its German buttons', async () => {
    const { fixture, button } = await render('Zu eng\nunter dem Kopf');
    const emitted: string[] = [];

    fixture.componentInstance.send.subscribe((text) => emitted.push(`send ${text}`));
    fixture.componentInstance.discard.subscribe(() => emitted.push('cancel'));
    button('Senden')?.click();
    button('Abbrechen')?.click();

    expect(emitted).toEqual(['send Zu eng\nunter dem Kopf', 'cancel']);
  });

  it('keeps Senden disabled while the text is empty', async () => {
    const { button } = await render('');

    expect(button('Senden')?.disabled).toBe(true);
  });

  it('disables the field and Abbrechen and sends nothing while busy', async () => {
    const { fixture, element, button } = await render('Text', 'busy');
    const emitted: string[] = [];

    fixture.componentInstance.send.subscribe(() => emitted.push('send'));
    button('Senden')?.click();

    expect(button('Abbrechen')?.disabled).toBe(true);
    expect(element.querySelector('textarea')?.disabled).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('shows the retry line and Erneut senden after a failed send', async () => {
    const { element, button } = await render('Text', 'error');

    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Kommentar nicht gesendet. Erneut versuchen.',
    );
    expect(button('Erneut senden')).toBeDefined();
  });

  it('shows the server reason and no retry button after a refused send', async () => {
    const { element, button } = await render('Text', 'rejected', 'components/card has no state "leer"');

    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe('components/card has no state "leer"');
    expect(button('Erneut senden')).toBeUndefined();
    expect(button('Senden')).toBeDefined();
  });

  it('sends on Enter, breaks the line on Shift+Enter and cancels on Escape', () => {
    expect(draftKeyOf({ key: 'Enter', shiftKey: false, isComposing: false })).toBe('send');
    expect(draftKeyOf({ key: 'Enter', shiftKey: true, isComposing: false })).toBeNull();
    expect(draftKeyOf({ key: 'Escape', shiftKey: false, isComposing: false })).toBe('cancel');
    expect(draftKeyOf({ key: 'Enter', shiftKey: false, isComposing: true })).toBeNull();
  });
});
