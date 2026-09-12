import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { SELECT_IMPORTS } from '../select.imports';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';

@Component({
  template: `
    <et-select [open]="outerOpen()" (openChange)="outerOpen.set($event)" class="outer" placeholder="Outer">
      <et-select-option value="x">X</et-select-option>
      <et-select [open]="innerOpen()" (openChange)="innerOpen.set($event)" class="inner" placeholder="Inner">
        <et-select-option value="a">A</et-select-option>
        <et-select-option value="b">B</et-select-option>
      </et-select>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class NestedSelectHost {
  outerOpen = signal(false);
  innerOpen = signal(false);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('Select nested overlay', () => {
  let fixture: ComponentFixture<NestedSelectHost>;

  const tick = () => TestBed.inject(ApplicationRef).tick();
  const panes = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane'));
  const outerTrigger = () => fixture.nativeElement.querySelector('.outer [role="combobox"], .outer [etselecttrigger]');

  const open = async (el: HTMLElement) => {
    el.click();
    tick();
    await flushFrames();
    tick();
  };

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [NestedSelectHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(NestedSelectHost);
    fixture.detectChanges();
  });

  afterEach(async () => {
    fixture.componentInstance.innerOpen.set(false);
    fixture.componentInstance.outerOpen.set(false);
    tick();
    await flushFrames();
  });

  it('keeps the outer panel open when a nested select popover is clicked', async () => {
    await open(outerTrigger());
    expect(panes().length).toBe(1);

    const innerTrigger = panes()[0]!.querySelector<HTMLElement>('.inner [role="combobox"], .inner [etselecttrigger]');
    expect(innerTrigger).not.toBeNull();
    await open(innerTrigger!);
    expect(panes().length).toBe(2);

    // click an option in the nested select's (topmost) pane. The pointerdown is what drives the
    // outside-pointer close, so dispatch it explicitly (jsdom's .click() fires only a click).
    const innerOption = panes().at(-1)!.querySelector<HTMLElement>('[role="option"]');
    expect(innerOption).not.toBeNull();
    innerOption!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    tick();
    innerOption!.click();
    tick();
    await flushFrames();
    tick();

    expect(fixture.componentInstance.innerOpen()).toBe(false);
    expect(fixture.componentInstance.outerOpen()).toBe(true);
  });
});
