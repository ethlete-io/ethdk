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
    const single = await render({ author: 'Tom', initials: 'TB' });

    expect((single.nativeElement as HTMLElement).querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      'Comment by Tom',
    );

    TestBed.resetTestingModule();

    const thread = await render({ author: 'Tom', initials: 'TB', count: 3 });

    expect((thread.nativeElement as HTMLElement).querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(
      'Comment by Tom, 3 messages',
    );
  });

  it('draws a resolved pin muted with a check mark instead of the initials and the count, also when selected', async () => {
    const fixture = await render({ author: 'Tom', initials: 'TB', count: 3, selected: true, resolved: true });
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector('button');

    expect(button?.getAttribute('aria-label')).toBe('Comment by Tom, 3 messages, resolved');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.classList).toContain('text-text-muted');
    expect(button?.classList).not.toContain('bg-et-theme');
    expect(button?.querySelector('svg path')?.getAttribute('d')).toBe('m3.5 8.5 3 3 6-7');
    expect(button?.textContent?.trim()).toBe('');
    expect(host.textContent).not.toContain('3');
  });

  it('emits pinToggle on a click', async () => {
    const fixture = await render({ author: 'Tom', initials: 'TB', selected: true });
    let toggles = 0;

    fixture.componentInstance.pinToggle.subscribe(() => toggles++);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-label]')?.click();

    expect(toggles).toBe(1);
  });
});
