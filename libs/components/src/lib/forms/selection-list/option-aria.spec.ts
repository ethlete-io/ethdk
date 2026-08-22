import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { expectDescribedByResolves } from '../testing/described-by';
import { resolveAccessibleName } from '../testing/accessible-name';
import { DESCRIPTION_IMPORTS } from '../description/description.imports';
import { RADIO_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS } from './selection-list.imports';

@Component({
  template: `
    <et-radio-group aria-label="Plan" name="plan">
      <et-radio value="team">
        Team
        <et-description>Everything in Solo, plus shared workspaces.</et-description>
      </et-radio>
    </et-radio-group>

    <et-segmented-button-group aria-label="View" name="view">
      <et-segmented-button value="day">Day</et-segmented-button>
    </et-segmented-button-group>
  `,
  imports: [RADIO_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS, DESCRIPTION_IMPORTS],
})
class OptionAriaTestHost {}

/**
 * An option pins its accessible name to its label span so a projected `<et-description>` cannot
 * fold into the name. That only works when the two ids the mechanism depends on exist: the label
 * span's, and the description's - each one missing loses the text it stands for entirely.
 */
describe('selection option aria', () => {
  const mount = () => {
    TestBed.configureTestingModule({
      imports: [OptionAriaTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    const fixture = TestBed.createComponent(OptionAriaTestHost);

    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  };

  it('describes an option by its projected et-description', () => {
    const option = mount().querySelector('et-radio') as Element;

    expect(option.getAttribute('aria-describedby')).toBeTruthy();
    expectDescribedByResolves(option);
  });

  it('names a segmented button from its own content', () => {
    const segment = mount().querySelector('et-segmented-button') as Element;

    expect(resolveAccessibleName(segment)).toBe('Day');
  });
});
