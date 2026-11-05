import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideQueryDevtools, ɵresetQueryDevtoolsForTesting } from '@ethlete/query';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { QueryDevtoolsLazyComponent } from '../lazy/query-devtools-lazy.component';

beforeAll(() => import('../lazy'));

const settle = async () => {
  const app = TestBed.inject(ApplicationRef);

  app.tick();
  await Promise.resolve();
  await Promise.resolve();
  app.tick();
  await app.whenStable();
};

afterEach(() => {
  TestBed.resetTestingModule();
  ɵresetQueryDevtoolsForTesting();
});

describe('provideQueryDevtools({ ui })', () => {
  it('should mount the devtools toggle once the application has rendered', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideQueryDevtools({ ui: () => import('../lazy') })],
    });

    await settle();
    await vi.waitFor(() => expect(document.body.querySelectorAll('et-query-devtools-lazy')).toHaveLength(1));

    TestBed.inject(ApplicationRef).tick();

    expect(document.body.querySelector('et-query-devtools-toggle')).not.toBeNull();
  });

  it('should remove the devtools when the application is destroyed', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideQueryDevtools({ ui: () => import('../lazy') })],
    });

    await settle();
    await vi.waitFor(() => expect(document.body.querySelector('et-query-devtools-lazy')).not.toBeNull());
    TestBed.resetTestingModule();

    expect(document.body.querySelector('et-query-devtools-lazy')).toBeNull();
  });

  it('should mount nothing without the ui option', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideQueryDevtools()] });

    await settle();

    expect(document.body.querySelector('et-query-devtools-lazy')).toBeNull();
  });

  it('should not mount a second devtools next to a template one', async () => {
    const ui = vi.fn(() => import('../lazy'));

    TestBed.configureTestingModule({
      imports: [QueryDevtoolsLazyComponent],
      providers: [provideZonelessChangeDetection(), provideQueryDevtools({ ui })],
    });

    const fixture = TestBed.createComponent(QueryDevtoolsLazyComponent);
    document.body.appendChild(fixture.nativeElement);

    await settle();

    expect(ui).not.toHaveBeenCalled();
    expect(document.body.querySelectorAll('et-query-devtools-toggle')).toHaveLength(1);

    fixture.nativeElement.remove();
  });
});
