import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListedComment } from '../../host/design';
import { CommentPanelComponent } from './comment-panel.component';
import { NumberedComment, ResolvedComment } from './comment-pins';

const listed = (id: string, text: string): ListedComment => ({
  id,
  part: 'components/card',
  state: 'empty',
  size: 'phone',
  text,
  createdAt: '2026-10-27T10:00:00Z',
  replies: [],
  threadState: 'agent',
  stale: null,
});

const OPEN: NumberedComment[] = [{ ...listed('a', 'Still open.'), number: 1 }];

const RESOLVED: ResolvedComment[] = [
  {
    ...listed('b', 'Make it rounder.'),
    resolved: {
      by: 'agent',
      author: 'claude-opus-5-5',
      reason: 'round',
      round: 'r2',
      resolvedAt: '2026-10-28T09:00:00Z',
      note: 'Too square.',
    },
  },
];

const render = (resolvedShown: boolean) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(CommentPanelComponent);
  const toggled: boolean[] = [];

  fixture.componentRef.setInput('comments', OPEN);
  fixture.componentRef.setInput('resolved', RESOLVED);
  fixture.componentRef.setInput('resolvedShown', resolvedShown);
  fixture.componentInstance.resolvedToggle.subscribe((shown) => toggled.push(shown));
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;

  return { element, toggled };
};

describe('CommentPanelComponent', () => {
  it('hides resolved threads by default and offers to show them', () => {
    const { element, toggled } = render(false);
    const toggle = element.querySelector<HTMLButtonElement>('[data-comment-resolved-toggle]');

    expect(element.querySelectorAll('[data-comment-entry]')).toHaveLength(1);
    expect(element.querySelector('[data-comment-resolved]')).toBeNull();
    expect(toggle?.textContent?.trim()).toBe('Show resolved (1)');

    toggle?.click();

    expect(toggled).toEqual([true]);
  });

  it('lists resolved threads read-only with who resolved them, why and the note', () => {
    const { element, toggled } = render(true);
    const resolved = element.querySelector('[data-comment-resolved]');

    expect(resolved?.textContent).toContain('Make it rounder.');
    expect(resolved?.querySelector('[data-comment-resolved-by]')?.textContent).toBe('new round r2 by claude-opus-5-5');
    expect(resolved?.querySelector('[data-comment-resolved-note]')?.textContent).toBe('Too square.');
    expect(resolved?.querySelector('button')).toBeNull();
    expect(element.querySelectorAll('[data-comment-entry]')).toHaveLength(1);

    element.querySelector<HTMLButtonElement>('[data-comment-resolved-toggle]')?.click();

    expect(toggled).toEqual([false]);
  });
});
