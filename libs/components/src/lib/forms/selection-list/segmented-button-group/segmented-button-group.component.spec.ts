import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../../test-helpers';
import { mountSelectionList, SelectionListDriver } from '../../testing/selection-list-driver';
import { ScrollableDirective } from '../../../scrollable/headless/scrollable.directive';
import { SCROLLABLE_IMPORTS } from '../../../scrollable/scrollable.imports';
import { SEGMENTED_BUTTON_IMPORTS } from '../selection-list.imports';
import { SegmentedButtonGroupComponent } from './segmented-button-group.component';

@Component({
  template: `
    <et-segmented-button-group
      [value]="value()"
      [variant]="variant()"
      [overflow]="overflow()"
      (valueChange)="value.set($event)"
    >
      <et-segmented-button value="day">Day</et-segmented-button>
      @if (showWeek()) {
        <et-segmented-button value="week">Week</et-segmented-button>
      }
    </et-segmented-button-group>
  `,
  imports: [SEGMENTED_BUTTON_IMPORTS],
})
class SegmentedButtonGroupTestHost {
  public value = signal<string | null>(null);
  public variant = signal<'pill' | 'tabs'>('pill');
  public overflow = signal<'truncate' | 'scroll'>('scroll');
  public showWeek = signal(true);
}

describe('SegmentedButtonGroupComponent', () => {
  let driver: SelectionListDriver<SegmentedButtonGroupTestHost>;

  beforeEach(() => {
    driver = mountSelectionList(SegmentedButtonGroupTestHost, {
      listSelector: 'et-segmented-button-group[role="radiogroup"]',
      optionSelector: 'et-segmented-button[role="radio"]',
    });
  });

  it('applies the selection-list directives to the group and every button', () => {
    expect(driver.listEl()).toBeInstanceOf(HTMLElement);
    expect(driver.optionEls()).toHaveLength(2);
  });

  it('selects a button and reflects its checked state', () => {
    driver.selectOption(1);

    expect(driver.host.value()).toBe('week');
    expect(driver.optionAttrs('aria-checked')).toEqual(['false', 'true']);
  });

  it('reflects the tabs variant on its host', () => {
    driver.host.variant.set('tabs');
    driver.fixture.detectChanges();

    expect(driver.attr('data-variant')).toBe('tabs');
    expect(driver.listEl().classList).toContain('et-tab-scale');
  });

  it('wraps the buttons in a scrollable by default and not for overflow truncate', () => {
    expect(driver.attr('data-overflow')).toBe('scroll');
    expect(driver.listEl().querySelectorAll('et-scrollable .et-segmented-button-group-buttons')).toHaveLength(1);
    expect(driver.optionEls()).toHaveLength(2);

    driver.host.overflow.set('truncate');
    driver.fixture.detectChanges();

    expect(driver.attr('data-overflow')).toBe('truncate');
    expect(driver.listEl().querySelector('et-scrollable')).toBeNull();
  });

  it('drops the active background reference when the checked button is destroyed', () => {
    driver.selectOption(1);
    driver.fixture.detectChanges();

    const group = driver.fixture.debugElement
      .query(By.directive(SegmentedButtonGroupComponent))
      .injector.get(SegmentedButtonGroupComponent);

    expect(group.lastActiveBackgroundElement()).not.toBeNull();

    driver.host.showWeek.set(false);
    driver.fixture.detectChanges();

    expect(group.lastActiveBackgroundElement()).toBeNull();
  });

  it('registers the checked segment with a surrounding scrollable and scrolls to a later selection', () => {
    @Component({
      template: `
        <et-scrollable>
          <et-segmented-button-group [value]="value()">
            <et-segmented-button value="a">A</et-segmented-button>
            <et-segmented-button value="b">B</et-segmented-button>
          </et-segmented-button-group>
        </et-scrollable>
      `,
      imports: [SEGMENTED_BUTTON_IMPORTS, SCROLLABLE_IMPORTS],
    })
    class ScrollableHost {
      public value = signal('a');
    }

    const fixture = TestBed.createComponent(ScrollableHost);
    fixture.detectChanges();

    const scrollable = fixture.debugElement.query(By.directive(ScrollableDirective)).injector.get(ScrollableDirective);
    const scrollSpy = vi.spyOn(scrollable, 'scrollToElement').mockImplementation(() => undefined);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('et-segmented-button')) as HTMLElement[];

    expect(
      scrollable
        .getActiveChildren()()
        .map((c) => c.elementRef.nativeElement),
    ).toEqual(buttons);
    expect(scrollable.getActiveChildren()()[0]?.isActiveChildEnabled()).toBe(true);
    expect(scrollable.getActiveChildren()()[1]?.isActiveChildEnabled()).toBe(false);

    fixture.componentInstance.value.set('b');
    fixture.detectChanges();

    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ element: buttons[1] }));
  });
});
