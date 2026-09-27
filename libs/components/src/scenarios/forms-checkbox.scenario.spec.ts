import { Component, computed, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { CheckboxComponent, CheckboxDirective } from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-roster-picker',
  imports: [CheckboxComponent],
  template: `
    <et-checkbox
      [checked]="allPicked()"
      [indeterminate]="somePicked()"
      (checkedChange)="pickAll($event)"
      class="all"
      aria-label="All players"
    />
    @for (player of players; track player) {
      <et-checkbox
        [checked]="picked().includes(player)"
        [attr.data-player]="player"
        [aria-label]="player"
        [readonly]="locked()"
        (checkedChange)="pick(player, $event)"
      />
    }
  `,
})
class RosterPickerComponent {
  players = ['team-a-1', 'team-a-2', 'team-a-3'];
  picked = signal<string[]>([]);
  locked = signal(false);
  allPicked = computed(() => this.picked().length === this.players.length);
  somePicked = computed(() => this.picked().length > 0 && !this.allPicked());
  all = viewChild.required(CheckboxComponent);

  pick(player: string, checked: boolean) {
    this.picked.update((list) => (checked ? [...list, player] : list.filter((entry) => entry !== player)));
  }

  pickAll(checked: boolean) {
    this.picked.set(checked ? [...this.players] : []);
  }
}

@Component({
  selector: 'et-scenario-custom-checkbox',
  imports: [CheckboxDirective],
  template: `
    <span [(checked)]="accepted" [disabled]="disabled()" etCheckbox aria-label="Accept">
      {{ accepted() ? 'yes' : 'no' }}
    </span>
  `,
})
class CustomCheckboxComponent {
  accepted = signal(false);
  disabled = signal(false);
  checkbox = viewChild.required(CheckboxDirective);
}

describe('checkbox scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('drives a select-all box through mixed, checked and unchecked', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RosterPickerComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const all = host.querySelector<HTMLElement>('.all')!;
    const player = (id: string) => host.querySelector<HTMLElement>(`[data-player="${id}"]`)!;

    s.tick();

    expect(all.getAttribute('role')).toBe('checkbox');
    expect(all.getAttribute('aria-checked')).toBe('false');
    expect(all.getAttribute('tabindex')).toBe('0');

    player('team-a-2').click();
    s.tick();

    expect(all.getAttribute('aria-checked')).toBe('mixed');
    expect(app.all().isIndeterminate()).toBe(true);

    s.keydown(' ', all);
    s.tick();

    expect(app.picked()).toEqual(['team-a-1', 'team-a-2', 'team-a-3']);
    expect(all.getAttribute('aria-checked')).toBe('true');
    expect(app.all().isChecked()).toBe(true);

    all.click();
    s.tick();

    expect(app.picked()).toEqual([]);

    app.all().focus();
    expect(document.activeElement).toBe(all);
    s.flush();
  });

  it('keeps a readonly box focusable but ignores clicks and Space', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RosterPickerComponent);
    const app = fixture.componentInstance;

    app.locked.set(true);
    s.tick();

    const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-player="team-a-1"]')!;

    expect(box.getAttribute('aria-readonly')).toBe('true');
    expect(box.getAttribute('tabindex')).toBe('0');

    box.click();
    s.keydown(' ', box);
    s.tick();

    expect(app.picked()).toEqual([]);
    expect(box.getAttribute('aria-checked')).toBe('false');
    s.flush();
  });

  it('turns custom markup into a checkbox with the headless directive', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CustomCheckboxComponent);
    const app = fixture.componentInstance;
    const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('span')!;

    s.tick();

    expect(box.getAttribute('role')).toBe('checkbox');
    expect(box.getAttribute('aria-label')).toBe('Accept');

    box.click();
    s.tick();

    expect(app.accepted()).toBe(true);
    expect(box.textContent?.trim()).toBe('yes');

    box.dispatchEvent(new FocusEvent('blur'));
    s.tick();

    expect(app.checkbox().touched()).toBe(true);

    app.disabled.set(true);
    s.tick();

    expect(box.getAttribute('aria-disabled')).toBe('true');
    expect(box.getAttribute('tabindex')).toBe('-1');

    app.checkbox().activate();
    s.tick();

    expect(app.accepted()).toBe(true);
    expect(document.activeElement).not.toBe(box);
  });
});
