import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { DESCRIPTION_IMPORTS, FORM_FIELD_IMPORTS, RADIO_GROUP_IMPORTS, RADIO_VARIANTS } from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-plan-picker',
  imports: [RADIO_GROUP_IMPORTS, DESCRIPTION_IMPORTS, FORM_FIELD_IMPORTS, FormField],
  template: `
    <et-radio-group [formField]="plan.tier" name="tier">
      <et-label>Plan</et-label>
      <et-radio [variant]="card" value="free">
        Free
        <et-description>One team, no history</et-description>
      </et-radio>
      <et-radio [variant]="card" value="club">
        Club
        <et-description id="club-perks">Every team and full history</et-description>
      </et-radio>
      <et-radio value="none">No plan</et-radio>
    </et-radio-group>
  `,
})
class PlanPickerComponent {
  card = RADIO_VARIANTS.CARD;
  model = signal({ tier: 'free' });
  plan = form(this.model);
}

describe('description scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('describes the option it sits in, under its own id or one it generates', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PlanPickerComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const [free, club, none] = Array.from(host.querySelectorAll('et-radio'));
    const [freeText, clubText] = Array.from(host.querySelectorAll('et-description'));

    expect(freeText!.classList).toContain('et-description');
    expect(freeText!.id).toMatch(/^et-description/);
    expect(free!.getAttribute('aria-describedby')).toBe(freeText!.id);
    expect(clubText!.id).toBe('club-perks');
    expect(club!.getAttribute('aria-describedby')).toBe('club-perks');
    expect(none!.hasAttribute('aria-describedby')).toBe(false);
    expect(host.querySelectorAll(`[id="${freeText!.id}"]`).length).toBe(1);
    s.flush();
  });
});
