import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CommentPinComponent } from './comment-pin.component';

const render = async (inputs: Record<string, unknown>) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(CommentPinComponent);

  Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  await fixture.whenStable();

  return fixture;
};

describe('CommentPinComponent', () => {
  it('names the author, and the message count when there is more than one', async () => {
    const single = await render({ author: 'human', initials: 'H' });

    expect((single.nativeElement as HTMLElement).querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      'Comment by human',
    );

    TestBed.resetTestingModule();

    const thread = await render({ author: 'human', initials: 'H', count: 3 });

    expect((thread.nativeElement as HTMLElement).querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      'Comment by human, 3 messages',
    );
  });

  it('draws a resolved pin muted with a check mark instead of the initials and the count, also when selected', async () => {
    const fixture = await render({ author: 'human', initials: 'H', count: 3, selected: true, resolved: true });
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('button');

    expect(button?.getAttribute('aria-label')).toBe('Comment by human, 3 messages, resolved');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.classList).toContain('text-text-muted');
    expect(button?.classList).not.toContain('bg-et-theme');
    expect(button?.querySelector('svg path')?.getAttribute('d')).toBe('m3.5 8.5 3 3 6-7');
    expect(button?.textContent?.trim()).toBe('');
    expect(host.textContent).not.toContain('3');
  });

  it('draws an unselected resolved pin with an agent as a check mark on the surface, not pressed', async () => {
    const fixture = await render({ author: 'Codex', agent: 'codex', count: 7, resolved: true });
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('button');

    expect(button?.getAttribute('aria-label')).toBe('Comment by Codex, 7 messages, resolved');
    expect(button?.hasAttribute('aria-pressed')).toBe(false);
    expect(button?.classList).toContain('ring-et-surface-border');
    expect(button?.querySelector('svg path')?.getAttribute('d')).toBe('m3.5 8.5 3 3 6-7');
    expect(host.querySelector('[ethlete-agent-logo]')).toBeNull();
    expect(host.textContent).not.toContain('7');
  });

  it('lets a click on the count badge pass through to the pin', async () => {
    const fixture = await render({ author: 'human', initials: 'H', count: 4 });
    const badge = (fixture.nativeElement as HTMLElement).querySelector('[aria-hidden="true"]');

    expect(badge?.textContent?.trim()).toBe('4');
    expect(badge?.classList).toContain('pointer-events-none');
  });

  it('emits pinToggle on a click', async () => {
    const fixture = await render({ author: 'human', initials: 'H', selected: true });
    let toggles = 0;

    fixture.componentInstance.pinToggle.subscribe(() => toggles++);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-label]')?.click();

    expect(toggles).toBe(1);
  });
});
