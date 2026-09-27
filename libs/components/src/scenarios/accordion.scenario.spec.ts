import { Component, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ACCORDION_ERROR_CODES,
  ACCORDION_GROUP_TOKEN,
  ACCORDION_IMPORTS,
  ACCORDION_TOKEN,
  AccordionComponent,
  AccordionContentDirective,
  AccordionDirective,
  AccordionGroupComponent,
  AccordionGroupDirective,
  AccordionHintDirective,
  AccordionLabelDirective,
  AccordionPanelDirective,
  AccordionTriggerDirective,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-revenue-chart',
  template: '<p class="revenue-chart">Chart for {{ accordion.ID }} in a group of {{ group?.accordions()?.length }}</p>',
})
class RevenueChartComponent {
  static created = 0;
  accordion = inject(ACCORDION_TOKEN);
  group = inject(ACCORDION_GROUP_TOKEN, { optional: true });

  constructor() {
    RevenueChartComponent.created++;
  }
}

@Component({
  selector: 'et-scenario-faq',
  imports: [
    AccordionGroupComponent,
    AccordionComponent,
    AccordionLabelDirective,
    AccordionHintDirective,
    AccordionContentDirective,
    RevenueChartComponent,
  ],
  template: `
    <et-accordion-group [autoCloseOthers]="single()" [preventCloseLast]="keepOne()">
      <et-accordion [(isOpen)]="shippingOpen" label="Shipping" headingLevel="2">Ships in 2-4 days.</et-accordion>
      <et-accordion isOpenByDefault>
        <ng-template etAccordionLabel><strong class="returns-label">Returns</strong></ng-template>
        <ng-template etAccordionHint>30 days</ng-template>
        No questions asked.
      </et-accordion>
      <et-accordion label="Revenue">
        <ng-template etAccordionContent><et-scenario-revenue-chart /></ng-template>
      </et-accordion>
      <et-accordion disabled label="Archive">Old stuff.</et-accordion>
    </et-accordion-group>
  `,
})
class FaqComponent {
  shippingOpen = signal(false);
  single = signal(false);
  keepOne = signal(false);
  group = viewChild.required(AccordionGroupDirective);
}

@Component({
  selector: 'et-scenario-headless-faq',
  imports: [ACCORDION_IMPORTS],
  template: `
    <div etAccordionGroup arrowKeyNavigation="false">
      @for (item of items(); track item) {
        <div #acc="etAccordion" etAccordion>
          <h3>
            <button class="headless-trigger" etAccordionTrigger>{{ item }}</button>
          </h3>
          @if (acc.isOpen()) {
            <div class="headless-panel" etAccordionPanel>{{ item }} body</div>
          }
        </div>
      }
    </div>
  `,
})
class HeadlessFaqComponent {
  items = signal(['Kits', 'Venues']);
  group = viewChild.required(AccordionGroupDirective);
}

@Component({
  selector: 'et-scenario-broken-accordions',
  imports: [AccordionDirective, AccordionTriggerDirective, AccordionPanelDirective, AccordionHintDirective],
  template: `
    <div etAccordion isOpenByDefault><button etAccordionTrigger>No panel</button></div>
    <div etAccordion></div>
    <ng-template etAccordionHint>stray</ng-template>
  `,
})
class BrokenAccordionsComponent {}

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('accordion scenarios', () => {
  const scenario = useScenario();

  it('wires the default accordions for assistive tech, defers lazy content and honors disabled', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FaqComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    RevenueChartComponent.created = 0;
    s.tick();
    s.flush();

    const accordions = queryAll('et-accordion', host);
    const triggers = queryAll<HTMLButtonElement>('.et-accordion-trigger', host);
    const panels = queryAll('[role="region"]', host);

    expect(host.querySelector('et-accordion-group')?.classList).toContain('et-accordion-group');
    expect(accordions.map((accordion) => accordion.classList.contains('et-accordion'))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(queryAll('[role="heading"]', host).map((heading) => heading.getAttribute('aria-level'))).toEqual([
      '2',
      '3',
      '3',
      '3',
    ]);
    expect(triggers.map(text)).toEqual(['Shipping', 'Returns 30 days', 'Revenue', 'Archive']);
    expect(host.querySelector('.returns-label')).not.toBeNull();
    expect(text(host.querySelector('.et-accordion-hint'))).toBe('30 days');
    expect(triggers.map((trigger) => trigger.getAttribute('aria-expanded'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    expect(triggers[0]?.getAttribute('type')).toBe('button');
    expect(triggers[0]?.getAttribute('aria-controls')).toBe(panels[0]?.id);
    expect(panels[0]?.getAttribute('aria-labelledby')).toBe(triggers[0]?.id);
    expect(panels.map((panel) => panel.hasAttribute('inert'))).toEqual([true, false, true, true]);
    expect(panels[1]?.hasAttribute('data-open')).toBe(true);

    triggers[0]?.click();
    s.tick();
    expect(app.shippingOpen()).toBe(true);
    expect(panels[0]?.hasAttribute('inert')).toBe(false);

    app.shippingOpen.set(false);
    s.tick();
    expect(triggers[0]?.getAttribute('aria-expanded')).toBe('false');

    expect(RevenueChartComponent.created).toBe(0);
    triggers[2]?.click();
    s.tick();
    expect(RevenueChartComponent.created).toBe(1);
    expect(text(host.querySelector('.revenue-chart'))).toMatch(/^Chart for et-accordion-\S+ in a group of 4$/);

    triggers[2]?.click();
    s.tick();
    expect(triggers[2]?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.revenue-chart')).not.toBeNull();
    triggers[2]?.click();
    s.tick();
    expect(RevenueChartComponent.created).toBe(1);

    expect(triggers[3]?.getAttribute('aria-disabled')).toBe('true');
    expect(triggers[3]?.disabled).toBe(false);
    triggers[3]?.click();
    s.tick();
    expect(triggers[3]?.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps one panel open, blocks closing the last one and moves focus between headers', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FaqComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const triggers = queryAll<HTMLButtonElement>('.et-accordion-trigger', host);
    const expanded = () => triggers.map((trigger) => trigger.getAttribute('aria-expanded') === 'true');

    app.group().openAll();
    s.tick();
    expect(expanded()).toEqual([true, true, true, false]);

    app.single.set(true);
    s.tick();
    expect(expanded()).toEqual([true, false, false, false]);

    triggers[2]?.click();
    s.tick();
    expect(expanded()).toEqual([false, false, true, false]);

    app.group().openAll();
    s.tick();
    expect(expanded()).toEqual([false, false, true, false]);

    app.keepOne.set(true);
    s.tick();
    triggers[2]?.click();
    s.tick();
    expect(expanded()).toEqual([false, false, true, false]);

    app.group().closeAll();
    s.tick();
    expect(expanded()).toEqual([false, false, false, false]);

    triggers[0]?.focus();
    s.keydown('ArrowDown', triggers[0]);
    expect(document.activeElement).toBe(triggers[1]);
    s.keydown('End', triggers[1]);
    expect(document.activeElement).toBe(triggers[3]);
    s.keydown('ArrowDown', triggers[3]);
    expect(document.activeElement).toBe(triggers[0]);
    s.keydown('ArrowUp', triggers[0]);
    expect(document.activeElement).toBe(triggers[3]);
    s.keydown('Home', triggers[3]);
    expect(document.activeElement).toBe(triggers[0]);
  });

  it('builds a headless accordion list whose panels mount only while open', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessFaqComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const triggers = () => queryAll<HTMLButtonElement>('.headless-trigger', host);

    expect(triggers()[0]?.hasAttribute('aria-controls')).toBe(false);

    triggers()[0]?.click();
    s.tick();
    expect(text(host.querySelector('.headless-panel'))).toBe('Kits body');
    expect(triggers()[0]?.getAttribute('aria-controls')).toBe(host.querySelector('.headless-panel')?.id);

    triggers()[0]?.focus();
    s.keydown('ArrowDown', triggers()[0]);
    expect(document.activeElement).toBe(triggers()[0]);

    app.items.set(['Venues', 'Kits', 'Staff']);
    s.tick();
    expect(
      app
        .group()
        .accordions()
        .map((accordion) => text(accordion.elementRef.nativeElement.querySelector('.headless-trigger'))),
    ).toEqual(triggers().map(text));

    app.items.set(['Staff']);
    s.tick();
    expect(app.group().accordions()).toHaveLength(1);
  });

  it('reports misuse with its error codes', () => {
    const s = scenario();

    TestBed.createComponent(BrokenAccordionsComponent);
    s.tick(1);

    for (const code of [
      ACCORDION_ERROR_CODES.MISSING_PANEL,
      ACCORDION_ERROR_CODES.MISSING_TRIGGER,
      ACCORDION_ERROR_CODES.PART_OUTSIDE_ACCORDION,
    ]) {
      s.expectError(`ET${code}`);
    }

    s.errors.length = 0;
  });
});
