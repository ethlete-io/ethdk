import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  BREADCRUMB_COLLAPSE_IMPORTS,
  BREADCRUMB_COLLAPSE_TOKEN,
  BREADCRUMB_ERROR_CODES,
  BREADCRUMB_IMPORTS,
  BREADCRUMB_LABELS,
  BREADCRUMB_SEGMENT_TOKEN,
  BREADCRUMB_SEO_IMPORTS,
  BREADCRUMB_TOKEN,
  BreadcrumbCollapseDirective,
  BreadcrumbComponent,
  BreadcrumbDirective,
  BreadcrumbItemDirective,
  BreadcrumbItemTemplateDirective,
  BreadcrumbOutletComponent,
  BreadcrumbOverflowComponent,
  BreadcrumbSegmentDirective,
  BreadcrumbSeoDirective,
  BreadcrumbSeparatorDirective,
  DEFAULT_BREADCRUMB_LABELS,
  injectBreadcrumbLabels,
  injectBreadcrumbManager,
  provideBreadcrumbLabels,
  provideBreadcrumbManager,
} from '../index';
import { fakeLayout, fakeResizeObserver } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const UNSTYLED_BLOCKS = 'et-breadcrumb { display: block; }';

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const trail = (root: ParentNode = document) =>
  Array.from(root.querySelectorAll('.et-breadcrumb-slot')).map((slot) =>
    slot.getAttribute('data-type') === 'overflow' ? '…' : text(slot.querySelector('.et-breadcrumb-item')),
  );

const settle = (s: Scenario) => {
  s.tick();
  s.frame(3);
  s.tick(400);
  s.frame(3);
};

const takeError = (s: Scenario, code: number) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => String((entry.error as Error | undefined)?.message).includes(`${code}`));

  return index === -1 ? undefined : (s.errors.splice(index, 1)[0]?.error as Error);
};

@Component({
  selector: 'et-scenario-crumb-probe',
  template: `{{ labels().navigation }}|{{ hasBreadcrumb }}`,
})
class CrumbProbeComponent {
  labels = injectBreadcrumbLabels();
  hasBreadcrumb = inject(BREADCRUMB_TOKEN) instanceof BreadcrumbDirective;
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-invoice-trail',
  imports: [BREADCRUMB_IMPORTS, CrumbProbeComponent],
  template: `
    <et-breadcrumb [labels]="labels()">
      <ng-template etBreadcrumbItemTemplate>
        <a (click)="$event.preventDefault(); visited.push('home')" class="home" etBreadcrumbItem href="/">Home</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate>
        <a class="invoices" etBreadcrumbItem href="/invoices">Invoices</a>
      </ng-template>
      @if (showTeam()) {
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem href="/invoices/team-a">team-a</a>
        </ng-template>
      }
      <ng-template [loading]="loading()" etBreadcrumbItemTemplate>
        <span class="current" etBreadcrumbItem>Invoice 4711</span>
        <et-scenario-crumb-probe />
      </ng-template>
      @if (slash()) {
        <ng-template etBreadcrumbSeparator><span class="slash">/</span></ng-template>
      }
    </et-breadcrumb>
  `,
})
class InvoiceTrailComponent {
  labels = signal<{ navigation?: string } | null>(null);
  loading = signal(false);
  showTeam = signal(false);
  slash = signal(false);
  visited: string[] = [];
}

@Component({
  selector: 'et-scenario-headless-trail',
  imports: [BreadcrumbDirective, BreadcrumbItemTemplateDirective, BreadcrumbItemDirective, NgTemplateOutlet],
  template: `
    <nav #trail="etBreadcrumb" etBreadcrumb>
      <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem href="/">Home</a></ng-template>
      <ng-template etBreadcrumbItemTemplate><span etBreadcrumbItem>Settings</span></ng-template>
      <ol class="own-list">
        @for (crumb of trail.items(); track $index) {
          <li><ng-container *ngTemplateOutlet="crumb.templateRef" /></li>
        }
      </ol>
    </nav>
  `,
})
class HeadlessTrailComponent {}

@Component({
  selector: 'et-scenario-segment-probe',
  template: `{{ segment.crumbs().length }}`,
})
class SegmentProbeComponent {
  segment = inject(BREADCRUMB_SEGMENT_TOKEN);
}

@Component({
  selector: 'et-scenario-teams-view',
  imports: [BREADCRUMB_IMPORTS],
  template: `
    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate name="Teams" url="https://example.com/teams">
        <a etBreadcrumbItem href="/teams">Teams</a>
      </ng-template>
    </ng-template>
    <p class="teams-view">Teams list</p>
  `,
})
class TeamsViewComponent {}

@Component({
  selector: 'et-scenario-team-detail-view',
  imports: [BREADCRUMB_IMPORTS, SegmentProbeComponent],
  template: `
    <ng-template etBreadcrumbSegment>
      <ng-template [loading]="loading()" [name]="loading() ? null : 'team-a'" etBreadcrumbItemTemplate>
        <span etBreadcrumbItem>team-a</span>
        <et-scenario-segment-probe />
      </ng-template>
    </ng-template>
  `,
})
class TeamDetailViewComponent {
  loading = signal(true);
}

@Component({
  selector: 'et-scenario-pinned-view',
  imports: [BREADCRUMB_IMPORTS],
  template: `
    <ng-template [order]="-1" etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate name="Home" url="https://example.com/">
        <a etBreadcrumbItem href="/">Home</a>
      </ng-template>
    </ng-template>
  `,
})
class PinnedViewComponent {}

@Component({
  selector: 'et-scenario-trail-reader',
  template: `{{ manager.crumbs().length }}/{{ manager.segments().length }}`,
})
class TrailReaderComponent {
  manager = injectBreadcrumbManager();
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-shell',
  imports: [
    BreadcrumbOutletComponent,
    BreadcrumbSeparatorDirective,
    BREADCRUMB_SEO_IMPORTS,
    TeamsViewComponent,
    TeamDetailViewComponent,
    PinnedViewComponent,
    TrailReaderComponent,
  ],
  providers: [provideBreadcrumbManager()],
  template: `
    <et-breadcrumb-outlet [labels]="{ navigation: 'Where you are' }" [etBreadcrumbSeo]="seo()">
      <ng-template etBreadcrumbSeparator>›</ng-template>
    </et-breadcrumb-outlet>
    <et-scenario-trail-reader />
    @if (teams()) {
      <et-scenario-teams-view />
      @if (detail()) {
        <et-scenario-team-detail-view />
      }
    }
    @if (pinned()) {
      <et-scenario-pinned-view />
    }
  `,
})
class ShellComponent {
  teams = signal(false);
  detail = signal(false);
  pinned = signal(false);
  seo = signal(true);
}

@Component({
  selector: 'et-scenario-collapse-probe',
  template: `{{ hasCollapse }}`,
})
class CollapseProbeComponent {
  hasCollapse = !!inject(BREADCRUMB_COLLAPSE_TOKEN, { optional: true });
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-long-trail',
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_COLLAPSE_IMPORTS, CollapseProbeComponent],
  template: `
    <div etBreadcrumbCollapse>
      <et-breadcrumb [collapse]="collapse()">
        <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem href="/">Home</a></ng-template>
        <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem href="/league">League</a></ng-template>
        <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem href="/league/teams">Teams</a></ng-template>
        <ng-template etBreadcrumbItemTemplate><span etBreadcrumbItem>team-a</span></ng-template>
      </et-breadcrumb>
      <et-scenario-collapse-probe />
    </div>
  `,
})
class LongTrailComponent {
  collapse = signal(true);
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-stray-crumb',
  imports: [BreadcrumbItemTemplateDirective, BreadcrumbComponent],
  template: `
    <ng-template etBreadcrumbItemTemplate><span>Stray</span></ng-template>
    <et-breadcrumb class="empty" />
  `,
})
class StrayCrumbComponent {}

@Component({
  selector: 'et-scenario-stray-seo',
  imports: [BreadcrumbSeoDirective],
  template: `<div etBreadcrumbSeo></div>`,
})
class StraySeoComponent {}

const structuredData = () =>
  Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
    (script) => JSON.parse(script.textContent ?? '') as { itemListElement: { name: string; item?: string }[] },
  );

describe('breadcrumb scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('renders a declared trail as a labelled landmark with the last crumb as the current page', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(InvoiceTrailComponent);
    const page = fixture.componentInstance;

    s.tick();

    const nav = query('et-breadcrumb');

    expect(nav.getAttribute('role')).toBe('navigation');
    expect(nav.getAttribute('aria-label')).toBe(DEFAULT_BREADCRUMB_LABELS.navigation);
    expect(trail()).toEqual(['Home', 'Invoices', 'Invoice 4711']);
    expect(query('.current').getAttribute('aria-current')).toBe('page');
    expect(query('.home').hasAttribute('aria-current')).toBe(false);
    expect(query('.home').classList).toContain('et-breadcrumb-item');
    expect(nav.querySelectorAll('.et-breadcrumb-separator')).toHaveLength(2);
    expect(
      Array.from(nav.querySelectorAll('.et-breadcrumb-separator')).every(
        (separator) => separator.getAttribute('aria-hidden') === 'true' && !!separator.querySelector('[etIcon]'),
      ),
    ).toBe(true);
    expect(text(query('et-scenario-crumb-probe'))).toBe('Breadcrumb|true');

    query('.home').click();
    expect(page.visited).toEqual(['home']);

    page.showTeam.set(true);
    page.labels.set({ navigation: 'Invoice path' });
    s.tick();

    expect(trail()).toEqual(['Home', 'Invoices', 'team-a', 'Invoice 4711']);
    expect(nav.getAttribute('aria-label')).toBe('Invoice path');
    expect(query('.current').getAttribute('aria-current')).toBe('page');

    page.slash.set(true);
    s.tick();

    expect(Array.from(nav.querySelectorAll('.et-breadcrumb-separator')).map(text)).toEqual(['/', '/', '/']);
    expect(nav.querySelector('.et-breadcrumb-chevron')).toBeNull();

    page.loading.set(true);
    s.tick();

    expect(nav.querySelector('.current')).toBeNull();
    expect(nav.querySelectorAll('.et-breadcrumb-slot')).toHaveLength(4);
    expect(nav.querySelector('.et-breadcrumb-slot:last-child et-skeleton')).not.toBeNull();

    page.loading.set(false);
    s.tick();

    expect(query('.current').getAttribute('aria-current')).toBe('page');
  });

  it('exposes the trail to a headless nav that renders its own list', () => {
    const s = scenario();

    TestBed.createComponent(HeadlessTrailComponent);
    s.tick();

    const nav = query('nav');

    expect(nav.getAttribute('role')).toBe('navigation');
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(Array.from(query('.own-list').querySelectorAll('li')).map(text)).toEqual(['Home', 'Settings']);
    expect(query('.own-list li:last-child span').getAttribute('aria-current')).toBe('page');
  });

  it('composes one trail from the segments of the views on screen, in view order', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance;

    s.tick();

    expect(document.querySelector('et-breadcrumb')).toBeNull();
    expect(text(query('et-scenario-trail-reader'))).toBe('0/0');
    expect(structuredData()).toEqual([]);

    shell.teams.set(true);
    s.tick();

    expect(trail()).toEqual(['Teams']);
    expect(query('et-breadcrumb').getAttribute('aria-label')).toBe('Where you are');
    expect(query('.et-breadcrumb-outlet-segments').hidden).toBe(true);

    shell.detail.set(true);
    s.tick();

    expect(trail()).toEqual(['Teams', '']);
    expect(query('et-breadcrumb .et-breadcrumb-slot:last-child et-skeleton')).not.toBeNull();
    expect(Array.from(document.querySelectorAll('.et-breadcrumb-separator')).map(text)).toEqual(['›']);
    expect(text(query('et-scenario-trail-reader'))).toBe('2/2');
    expect(structuredData()).toEqual([]);

    const detail = fixture.debugElement.query((node) => node.name === 'et-scenario-team-detail-view');

    (detail.componentInstance as TeamDetailViewComponent).loading.set(false);
    s.tick();

    expect(query('et-breadcrumb .et-breadcrumb-slot:last-child .et-breadcrumb-item').getAttribute('aria-current')).toBe(
      'page',
    );
    expect(text(query('et-scenario-segment-probe'))).toBe('1');
    expect(structuredData()).toEqual([
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Teams', item: 'https://example.com/teams' },
          { '@type': 'ListItem', position: 2, name: 'team-a' },
        ],
      },
    ]);

    shell.pinned.set(true);
    s.tick();

    expect(trail()).toEqual(['Home', 'Teams', 'team-a']);
    expect(structuredData()[0]?.itemListElement.map((item) => item.name)).toEqual(['Home', 'Teams', 'team-a']);

    shell.seo.set(false);
    s.tick();

    expect(structuredData()).toEqual([]);

    shell.teams.set(false);
    s.tick();

    expect(trail()).toEqual(['Home']);
    expect(text(query('et-scenario-trail-reader'))).toBe('1/1');

    fixture.destroy();
    s.tick();
  });

  it('moves the middle crumbs into an overflow toggletip once the trail does not fit', () => {
    const s = scenario();
    const observer = fakeResizeObserver();
    let available = 600;

    fakeLayout([{ match: 'et-breadcrumb', clientWidth: () => available }]);

    const original = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth');

    Object.defineProperty(Element.prototype, 'scrollWidth', {
      configurable: true,
      get(this: Element) {
        if (!this.matches('et-breadcrumb')) return (original?.get?.call(this) as number | undefined) ?? 0;

        return this.hasAttribute('data-collapsed') ? 150 : 420;
      },
    });
    onTestFinished(() => {
      if (original) Object.defineProperty(Element.prototype, 'scrollWidth', original);
      else Reflect.deleteProperty(Element.prototype, 'scrollWidth');
    });

    const fixture = TestBed.createComponent(LongTrailComponent);

    s.tick();
    observer.fire();
    s.tick();

    const nav = query('et-breadcrumb');

    expect(text(query('et-scenario-collapse-probe'))).toBe('true');
    expect(trail()).toEqual(['Home', 'League', 'Teams', 'team-a']);
    expect(nav.hasAttribute('data-collapsed')).toBe(false);

    available = 300;
    observer.fire();
    s.tick();

    expect(nav.hasAttribute('data-collapsed')).toBe(true);
    expect(trail()).toEqual(['Home', '…', 'team-a']);

    const overflow = query('et-breadcrumb-overflow');
    const toggle = query<HTMLButtonElement>('.et-breadcrumb-overflow-trigger', overflow);

    expect(overflow.classList).toContain('et-breadcrumb-overflow');
    expect(toggle.getAttribute('aria-label')).toBe(DEFAULT_BREADCRUMB_LABELS.overflow);
    expect(query('.et-breadcrumb-slot:last-child .et-breadcrumb-item').getAttribute('aria-current')).toBe('page');

    toggle.click();
    settle(s);

    const hidden = query('.et-breadcrumb-overflow-list');

    expect(nav.contains(hidden)).toBe(false);
    expect(Array.from(hidden.querySelectorAll('li')).map(text)).toEqual(['League', 'Teams']);

    toggle.click();
    settle(s);

    expect(document.querySelector('.et-breadcrumb-overflow-list')).toBeNull();

    available = 500;
    observer.fire();
    s.tick();
    s.tick();

    expect(nav.hasAttribute('data-collapsed')).toBe(false);
    expect(trail()).toEqual(['Home', 'League', 'Teams', 'team-a']);

    available = 300;
    fixture.componentInstance.collapse.set(false);
    observer.fire();
    s.tick();

    expect(nav.hasAttribute('data-collapsed')).toBe(false);
    expect(document.querySelector('et-breadcrumb-overflow')).toBeNull();

    fixture.destroy();
    settle(s);
  });

  it('reports parts outside a breadcrumb, an empty breadcrumb and a stray etBreadcrumbSeo', () => {
    const s = scenario();

    TestBed.createComponent(StrayCrumbComponent);
    s.tick();

    expect(takeError(s, BREADCRUMB_ERROR_CODES.PART_OUTSIDE_BREADCRUMB)?.message).toContain(
      'etBreadcrumbItemTemplate must be placed inside an [etBreadcrumb]',
    );
    expect(takeError(s, BREADCRUMB_ERROR_CODES.MISSING_ITEMS)?.message).toContain('This breadcrumb has no crumbs');
    s.errors.length = 0;

    expect(() => TestBed.createComponent(StraySeoComponent)).toThrow(
      String(BREADCRUMB_ERROR_CODES.SEO_OUTSIDE_BREADCRUMB),
    );
    s.errors.length = 0;
  });

  it('keeps the collapse, segment and seo directives importable one by one', () => {
    expect([BreadcrumbCollapseDirective]).toEqual([...BREADCRUMB_COLLAPSE_IMPORTS]);
    expect([BreadcrumbSeoDirective]).toEqual([...BREADCRUMB_SEO_IMPORTS]);
    expect(BREADCRUMB_IMPORTS).toContain(BreadcrumbSegmentDirective);
    expect(BreadcrumbOverflowComponent).toBeDefined();
  });
});

@Component({
  selector: 'et-scenario-label-probe',
  template: `{{ labels().navigation }}|{{ labels().overflow }}`,
})
class LabelProbeComponent {
  labels = injectBreadcrumbLabels();
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-german-labels',
  imports: [BREADCRUMB_IMPORTS, LabelProbeComponent],
  template: `
    <et-breadcrumb>
      <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem href="/">Start</a></ng-template>
      <ng-template etBreadcrumbItemTemplate><span etBreadcrumbItem>Rechnungen</span></ng-template>
    </et-breadcrumb>
    <et-scenario-label-probe />
  `,
})
class GermanLabelsComponent {
  labels = inject(BREADCRUMB_LABELS);
}

describe('breadcrumb scenarios with app-wide labels', () => {
  const scenario = useScenario({
    providers: [provideBreadcrumbLabels({ navigation: 'Brotkrumen' })],
  });

  it('localizes the landmark label and keeps the unset labels at their defaults', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GermanLabelsComponent);

    s.tick();

    expect(query('et-breadcrumb').getAttribute('aria-label')).toBe('Brotkrumen');
    expect(fixture.componentInstance.labels).toEqual({ navigation: 'Brotkrumen' });
    expect(text(query('et-scenario-label-probe'))).toBe(`Brotkrumen|${DEFAULT_BREADCRUMB_LABELS.overflow}`);
  });
});
