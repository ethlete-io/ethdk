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

describe('CheckoutsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('picks the remembered checkout, not the first kept one', async () => {
    const fixture = await mount(['/dev/alpha', '/dev/beta'], '/dev/beta');

    expect(fixture.componentInstance.current()).toBe('/dev/beta');
  });

  it('names a Windows checkout by its folder, and picks a checkout by that name', async () => {
    const fixture = await mount(['C:\\Users\\tom\\dev\\alpha', '/dev/beta'], '');
    const picks: string[] = [];

    fixture.componentInstance.pick.subscribe((path) => picks.push(path));
    fixture.componentInstance.chooseByName('beta');

    expect(fixture.componentInstance.names()).toEqual(['alpha', 'beta']);
    expect(fixture.componentInstance.current()).toBe('/dev/beta');
    expect(picks).toEqual(['/dev/beta']);
  });
});
