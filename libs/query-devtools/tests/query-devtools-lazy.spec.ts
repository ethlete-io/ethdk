import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideQueryDevtools } from '@ethlete/query';
import { beforeEach, describe, expect, it } from 'vitest';
import { QueryDevtoolsLazyComponent } from '../lazy/query-devtools-lazy.component';

const pressShortcut = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', ctrlKey: true, altKey: true }));

// `provideQueryDevtools()` latches a module-level flag that nothing resets, so the disabled suite has to
// run before the enabled one - moving it below turns its assertions into the opposite of what they mean.
describe('QueryDevtoolsLazyComponent without provideQueryDevtools()', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QueryDevtoolsLazyComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  it('should render nothing', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('et-query-devtools-toggle')).toBeNull();
    expect(host.querySelector('et-query-devtools')).toBeNull();
  });

  it('should not open the panel on the keyboard shortcut', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    pressShortcut();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('et-query-devtools')).toBeNull();
  });
});

describe('QueryDevtoolsLazyComponent with provideQueryDevtools()', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QueryDevtoolsLazyComponent],
      providers: [provideZonelessChangeDetection(), provideQueryDevtools()],
    });
  });

  it('should render the floating toggle', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('et-query-devtools-toggle')).not.toBeNull();
  });
});
