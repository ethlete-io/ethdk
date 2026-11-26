import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { CommentSendPhase } from '../system-page/comment-draft.component';
import { ThreadCardComponent, ThreadMessage } from './thread-card.component';

const MESSAGES: ThreadMessage[] = [
  { author: 'Kim Lange', initials: 'KL', own: true, when: 'gestern', text: 'Die Kachel ist zu schmal.' },
  { author: 'Gemini', initials: 'G', agent: 'gemini', when: 'vor 5 Min', text: 'Ich nehme 18 statt 16.' },
];

const render = async ({
  text = '',
  phase = null,
  reason = '',
}: { text?: string; phase?: CommentSendPhase | null; reason?: string } = {}) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(ThreadCardComponent);

  fixture.componentRef.setInput('place', 'card › compact · hover');
  fixture.componentRef.setInput('messages', MESSAGES);
  fixture.componentRef.setInput('text', text);
  fixture.componentRef.setInput('phase', phase);
  fixture.componentRef.setInput('reason', reason);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;
  const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('button')];
  const button = (label: string) => buttons().find((candidate) => candidate.textContent?.trim() === label);

  return { fixture, element, buttons, button };
};

describe('ThreadCardComponent', () => {
  it('shows the place, every message and Zurückziehen only under the own one', async () => {
    const { element, buttons } = await render();

    expect(element.textContent).toContain('card › compact · hover');
    expect(element.querySelectorAll('li')).toHaveLength(2);
    expect(element.textContent).toContain('Ich nehme 18 statt 16.');
    expect(buttons().filter((candidate) => candidate.textContent?.trim() === 'Zurückziehen')).toHaveLength(1);
  });

  it('emits resolve, withdraw with the message index, close and the reply', async () => {
    const { fixture, element, button } = await render({ text: 'Passt so.' });
    const emitted: string[] = [];
    const card = fixture.componentInstance;

    card.resolveThread.subscribe(() => emitted.push('resolve'));
    card.withdrawComment.subscribe((index) => emitted.push(`withdraw ${index}`));
    card.dismiss.subscribe(() => emitted.push('close'));
    card.replyComment.subscribe((text) => emitted.push(`reply ${text}`));
    button('Erledigen')?.click();
    button('Zurückziehen')?.click();
    element.querySelector<HTMLButtonElement>('button[aria-label="Faden schließen"]')?.click();
    button('Antworten')?.click();
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(emitted).toEqual(['resolve', 'withdraw 0', 'close', 'reply Passt so.', 'close']);
  });

  it('keeps Antworten disabled while the reply is empty', async () => {
    const { button } = await render();

    expect(button('Antworten')?.disabled).toBe(true);
  });

  it('offers Erneut senden after a failed send and shows the reason of a refused one without a retry', async () => {
    const failed = await render({ text: 'Passt so.', phase: 'error' });

    expect(failed.element.textContent).toContain('Kommentar nicht gesendet. Erneut versuchen.');
    expect(failed.button('Erneut senden')).toBeTruthy();

    TestBed.resetTestingModule();
    const refused = await render({ text: 'Passt so.', phase: 'rejected', reason: 'Der Teil ist weg.' });

    expect(refused.element.textContent).toContain('Der Teil ist weg.');
    expect(refused.button('Erneut senden')).toBeUndefined();
    expect(refused.button('Antworten')).toBeTruthy();
  });

  it('disables the field while the reply is sent', async () => {
    const { element } = await render({ text: 'Passt so.', phase: 'busy' });

    expect(element.querySelector('textarea')?.disabled).toBe(true);
  });
});
