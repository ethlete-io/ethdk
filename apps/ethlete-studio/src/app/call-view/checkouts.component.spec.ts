import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckoutsComponent } from './checkouts.component';

const stubHost = (roots: string[]) => {
  let next = 1;

  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke: (command: string) =>
        command === 'design_roots' ? Promise.resolve({ search: '', roots }) : new Promise(() => undefined),
      transformCallback: () => next++,
      unregisterCallback: () => undefined,
    },
  });
};

const settle = async (fixture: ComponentFixture<CheckoutsComponent>) => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
};

const mount = async (roots: string[], remembered: string) => {
  stubHost(roots);

  const fixture = TestBed.createComponent(CheckoutsComponent);

  fixture.componentRef.setInput('remembered', remembered);
  fixture.autoDetectChanges();
  await settle(fixture);

  return fixture;
};

const picker = (fixture: ComponentFixture<CheckoutsComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('select');

describe('CheckoutsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('shows the remembered checkout in the picker, not the first kept one', async () => {
    const fixture = await mount(['/dev/alpha', '/dev/beta'], '/dev/beta');

    expect(picker(fixture)?.value).toBe('/dev/beta');
  });
});
