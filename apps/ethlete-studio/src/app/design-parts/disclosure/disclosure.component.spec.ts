import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DisclosureComponent } from './disclosure.component';

const PADDING = ['pt-space-1', 'pl-[calc(var(--space-2)+14px+var(--space-2))]'];

describe('DisclosureComponent', () => {
  it('pads the body wrapper, not the open panel', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(DisclosureComponent);

    fixture.componentRef.setInput('label', 'Details');
    fixture.componentRef.setInput('body', '<p>Body</p>');
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();

    const body = (fixture.nativeElement as HTMLElement).querySelector('p')?.parentElement;
    const panel = body?.parentElement;

    PADDING.forEach((name) => {
      expect(body?.classList.contains(name)).toBe(true);
      expect(panel?.classList.contains(name)).toBe(false);
    });
  });
});
