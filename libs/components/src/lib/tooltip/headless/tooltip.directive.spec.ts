import { Component, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { setInputSignal } from '@ethlete/core';
import '../../../test-helpers';
import { dialogOverlayStrategy } from '../../overlay/strategies';
import { pointerEnter, pressKey } from '../../testing/driver-core';
import { fakeLayout } from '../../testing/fake-layout';
import { createOverlayDriver } from '../../testing/overlay-driver';
import { TooltipContent, TooltipDirective } from './tooltip.directive';

@Component({
  template: `
    <button etTooltip type="button">Trigger</button>

    <ng-template #tooltipTemplate>
      <span class="tooltip-template-content">Template tooltip</span>
    </ng-template>
  `,
  imports: [TooltipDirective],
})
class TooltipDirectiveTestHost {
  tooltipTemplate = viewChild.required<TemplateRef<unknown>>('tooltipTemplate');
}

@Component({
  template: `<button aria-describedby="consumer-hint" etTooltip type="button">Trigger</button>`,
  imports: [TooltipDirective],
})
class DescribedTooltipTestHost {}

describe('TooltipDirective', () => {
  let fixture: ComponentFixture<TooltipDirectiveTestHost>;
  let button: HTMLButtonElement;
  let tooltipDirective: TooltipDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TooltipDirectiveTestHost],
    });

    fixture = TestBed.createComponent(TooltipDirectiveTestHost);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button');
    tooltipDirective = fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);
    setInputSignal(tooltipDirective.content, 'Tooltip body' satisfies TooltipContent);
    setInputSignal(tooltipDirective.showDelay, 0);
    fixture.detectChanges();
  });

  afterEach(() => {
    tooltipDirective.hide();
  });

  it('creates a hidden accessible description for string content', () => {
    const descriptionId = button.getAttribute('aria-describedby');

    expect(descriptionId).toContain('et-tooltip-description');
    expect(document.getElementById(descriptionId ?? '')?.textContent).toBe('Tooltip body');
  });

  it('switches aria-describedby to the live tooltip id while shown', () => {
    const fallbackDescriptionId = button.getAttribute('aria-describedby');

    tooltipDirective.show();
    fixture.detectChanges();

    expect(button.getAttribute('aria-describedby')).toBe(tooltipDirective.overlayRef()?.config.id ?? null);

    tooltipDirective.hide();
    fixture.detectChanges();

    expect(button.getAttribute('aria-describedby')).toBe(fallbackDescriptionId);
  });

  it('points at the anchor element while the trigger keeps the description', () => {
    const anchor = document.createElement('span');
    document.body.appendChild(anchor);
    setInputSignal(tooltipDirective.anchor, anchor);

    tooltipDirective.show();
    fixture.detectChanges();

    expect(tooltipDirective.overlayRef()?.config.origin).toBe(anchor);
    expect(button.getAttribute('aria-describedby')).toBe(tooltipDirective.overlayRef()?.config.id ?? null);

    tooltipDirective.hide();
    anchor.remove();
  });

  it('does not open when disabled', () => {
    setInputSignal(tooltipDirective.disabled, true);
    fixture.detectChanges();

    tooltipDirective.show();

    expect(tooltipDirective.overlayRef()).toBeNull();
  });

  it('re-renders content that changes while shown', () => {
    tooltipDirective.show();
    fixture.detectChanges();

    setInputSignal(tooltipDirective.content, 'Updated body');
    fixture.detectChanges();

    const panelId = tooltipDirective.overlayRef()?.config.id ?? '';
    expect(document.getElementById(panelId)?.textContent).toContain('Updated body');
  });

  it('appends to a consumer aria-describedby instead of replacing it', () => {
    const describedFixture = TestBed.createComponent(DescribedTooltipTestHost);
    describedFixture.detectChanges();
    const describedButton = describedFixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const directive = describedFixture.debugElement
      .query(By.directive(TooltipDirective))
      .injector.get(TooltipDirective);
    setInputSignal(directive.content, 'Tooltip body');
    describedFixture.detectChanges();

    const idle = describedButton.getAttribute('aria-describedby') ?? '';
    expect(idle).toContain('consumer-hint');
    expect(idle).toContain('et-tooltip-description');

    directive.show();
    describedFixture.detectChanges();

    const shown = describedButton.getAttribute('aria-describedby') ?? '';
    expect(shown).toContain('consumer-hint');
    expect(shown).toContain(directive.overlayRef()?.config.id ?? '');
    expect(shown).not.toContain('et-tooltip-description');

    directive.hide();
    describedFixture.detectChanges();

    expect(describedButton.getAttribute('aria-describedby')).toBe(idle);
  });

  it('throws when template content is used without an aria description', () => {
    setInputSignal(tooltipDirective.content, fixture.componentInstance.tooltipTemplate());
    fixture.detectChanges();

    expect(() => tooltipDirective.show()).toThrow(/Template tooltips require etTooltipAriaDescription/);
  });
});

@Component({
  template: `<button [showDelay]="0" class="dialog-trigger" etTooltip="Dialog tip" type="button">Inside</button>`,
  imports: [TooltipDirective],
})
class TooltipInsideDialogComponent {}

describe('TooltipDirective inside a modal overlay', () => {
  let driver: ReturnType<typeof createOverlayDriver>;

  const tooltipCount = () => document.querySelectorAll('[role="tooltip"]').length;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    // floating-ui reads the trigger as clipped out of a zero-sized viewport otherwise, and
    // `autoCloseIfReferenceHidden` then closes the tooltip on its first positioning frame
    fakeLayout([
      { match: 'html', clientWidth: 1024, clientHeight: 768 },
      { match: '.dialog-trigger', rect: { x: 100, y: 100, width: 80, height: 32 } },
    ]);
    driver = createOverlayDriver();
  });

  afterEach(() => {
    driver.closeAll();
  });

  const openDialogWithHoveredTooltip = async () => {
    const dialogRef = await driver.open(TooltipInsideDialogComponent, { strategies: dialogOverlayStrategy() });
    let closedVia: string | null = null;

    dialogRef.afterClosedEvent().subscribe((event) => (closedVia = event.source));

    const trigger = driver.paneEl<HTMLButtonElement>('.dialog-trigger');

    if (!trigger) throw new Error('the dialog did not render its tooltip trigger');

    pointerEnter(trigger);
    await new Promise<void>((resolve) => setTimeout(resolve));
    driver.tick();
    await driver.settle();

    expect(tooltipCount()).toBe(1);

    return { closedVia: () => closedVia };
  };

  it('Escape dismisses a hover-shown tooltip and leaves the dialog beneath it open', async () => {
    const { closedVia } = await openDialogWithHoveredTooltip();

    pressKey(document, 'Escape');
    await driver.settle();

    expect(tooltipCount()).toBe(0);
    expect(closedVia()).toBeNull();

    pressKey(document, 'Escape');
    await driver.settle();
    await driver.settle();

    expect(closedVia()).toBe('escape');
  });

  it('a backdrop press closes the dialog while a tooltip is shown inside it', async () => {
    const { closedVia } = await openDialogWithHoveredTooltip();

    await driver.clickBackdrop();
    await driver.settle();

    expect(closedVia()).toBe('outside-pointer');
  });
});

@Component({
  template: `
    <svg>
      <rect [showDelay]="0" class="svg-trigger" etTooltip="Bar tip" height="40" tabindex="0" width="20" />
    </svg>
  `,
  imports: [TooltipDirective],
})
class SvgTooltipTestHost {}

describe('TooltipDirective on an svg element', () => {
  let fixture: ComponentFixture<SvgTooltipTestHost>;
  let rect: SVGRectElement;
  let tooltipDirective: TooltipDirective;
  let driver: ReturnType<typeof createOverlayDriver>;

  const tooltipPane = () =>
    document.querySelector<HTMLElement>('.et-tooltip-panel')?.closest<HTMLElement>('.et-overlay-runtime-pane') ?? null;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SvgTooltipTestHost] });
    fakeLayout([
      { match: 'html', clientWidth: 1024, clientHeight: 768 },
      { match: '.svg-trigger', rect: { x: 300, y: 200, width: 20, height: 40 } },
    ]);
    fixture = TestBed.createComponent(SvgTooltipTestHost);
    fixture.detectChanges();
    driver = createOverlayDriver();
    rect = fixture.nativeElement.querySelector('rect');
    tooltipDirective = fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);
  });

  afterEach(() => {
    tooltipDirective.hide();
    driver.closeAll();
  });

  it('anchors the tooltip to the svg element and describes it', async () => {
    tooltipDirective.show();
    await driver.settle();
    await driver.settle();

    expect(rect.getAttribute('aria-describedby')).toBe(tooltipDirective.overlayRef()?.config.id ?? null);
    expect(tooltipPane()?.getAttribute('data-overlay-placement')).toBe('top');
    expect(tooltipPane()?.style.transform).toBe('translate3d(310px, 192px, 0)');
  });

  it('closes the tooltip when the svg element leaves the document', async () => {
    tooltipDirective.show();
    await driver.settle();
    await driver.settle();

    expect(tooltipPane()).not.toBeNull();

    rect.remove();
    window.dispatchEvent(new Event('resize'));
    await driver.settle();
    await driver.settle();

    expect(tooltipDirective.overlayRef()).toBeNull();
  });
});
