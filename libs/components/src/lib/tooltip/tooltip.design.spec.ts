import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Placement } from '@floating-ui/dom';
import { tooltip, TooltipMockOptions } from '../../../design/tooltip';
import '../../test-helpers';
import { fakeLayout } from '../testing/fake-layout';
import { mockShapeOf, shapeOf } from '../testing/design-mock-shape';
import { createOverlayDriver } from '../testing/overlay-driver';
import { TooltipDirective } from './headless/tooltip.directive';
import { TOOLTIP_IMPORTS } from './tooltip.imports';

@Component({
  imports: [TOOLTIP_IMPORTS],
  template: `
    <button
      [etTooltip]="useTemplate() ? richContent : 'Copy link'"
      [placement]="placement()"
      [showDelay]="0"
      class="trigger"
      etTooltipAriaDescription="Copy link"
      type="button"
    >
      Copy
    </button>
    <ng-template #richContent><strong>Copy link</strong></ng-template>
  `,
})
class TooltipHost {
  public placement = input<Placement>('top');
  public useTemplate = input(false);
}

const CASES: TooltipMockOptions[] = [
  { text: 'Copy link' },
  { text: 'Copy link', placement: 'right' },
  { text: 'Copy link', placement: 'bottom-start' },
  { content: '<strong>Copy link</strong>', placement: 'left' },
];

describe('tooltip design mock', () => {
  let driver: ReturnType<typeof createOverlayDriver>;

  beforeEach(() => {
    fakeLayout([
      { match: 'html', clientWidth: 1024, clientHeight: 768 },
      { match: '.trigger', rect: { x: 400, y: 300, width: 80, height: 32 } },
    ]);
  });

  afterEach(() => driver.closeAll());

  it.each(CASES)('draws the pane and tooltip the overlay renders for %o', async (options) => {
    const fixture = TestBed.createComponent(TooltipHost);

    if (options.placement) fixture.componentRef.setInput('placement', options.placement);
    if (options.content) fixture.componentRef.setInput('useTemplate', true);

    fixture.detectChanges();
    driver = createOverlayDriver();

    const directive = fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);
    directive.show();
    for (let frame = 0; frame < 10; frame++) {
      driver.tick();
      await driver.settle();
    }

    const pane = document.querySelector('.et-tooltip-panel');
    if (!pane) throw new Error('the tooltip did not open');

    expect(mockShapeOf(tooltip(options), '.et-tooltip-panel')).toEqual(shapeOf(pane));
  });
});
