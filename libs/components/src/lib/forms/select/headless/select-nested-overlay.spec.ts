import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { SELECT_IMPORTS } from '../select.imports';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: { default: '0 0 0', disabled: '0 36 23' },
    },
  },
  {
    name: 'red',
    type: 'error' as const,
    primary: {
      color: { default: '255 0 0', hover: '255 76 76', focus: '255 76 76', active: '198 0 0', disabled: '128 32 32' },
      onColor: { default: '0 0 0', disabled: '48 0 0' },
    },
  },
] as const;

// Outer select whose panel projects a nested select — the Task 4 scenario: a popover opened from
// inside an anchored panel mounts as a sibling pane, so a pointerdown in it must not close the outer.
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

    // open the nested select — its trigger sits inside the outer pane
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

    // the nested select committed and closed, but the outer panel must stay open (before the fix
    // the outer treated the click in the nested pane as an outside-pointer close)
    expect(fixture.componentInstance.innerOpen()).toBe(false);
    expect(fixture.componentInstance.outerOpen()).toBe(true);
  });
});
