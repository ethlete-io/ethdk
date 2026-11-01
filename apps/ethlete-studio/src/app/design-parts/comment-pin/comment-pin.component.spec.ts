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

  it('emits pinToggle on a click', async () => {
    const fixture = await render({ author: 'Tom', initials: 'TB', selected: true });
    let toggles = 0;

    fixture.componentInstance.pinToggle.subscribe(() => toggles++);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-label]')?.click();

    expect(toggles).toBe(1);
  });
});
