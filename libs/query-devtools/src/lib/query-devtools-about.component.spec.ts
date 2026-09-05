import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryDevtoolsAboutComponent } from './query-devtools-about.component';

const COPIED_RESET_MS = 1200;

describe('QueryDevtoolsAboutComponent', () => {
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    TestBed.configureTestingModule({
      imports: [QueryDevtoolsAboutComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('should stop confirming a copy once its tick has expired', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsAboutComponent);
    await fixture.whenStable();

    const button = fixture.nativeElement.querySelector<HTMLButtonElement>('button');

    button?.click();
    await fixture.whenStable();

    expect(button?.textContent?.trim()).toContain('Copied');

    await new Promise((resolve) => setTimeout(resolve, COPIED_RESET_MS + 100));
    await fixture.whenStable();

    expect(button?.textContent?.trim()).not.toContain('Copied');
  });
});
