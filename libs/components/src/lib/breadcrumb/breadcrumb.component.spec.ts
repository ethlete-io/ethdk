import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { BreadcrumbOutletComponent } from './breadcrumb-outlet.component';
import { provideBreadcrumbLabels } from './breadcrumb-labels';
import { provideBreadcrumbManager } from './breadcrumb-manager';
import { BreadcrumbComponent } from './breadcrumb.component';
import { BreadcrumbOverflowComponent } from './breadcrumb-overflow.component';
import { BREADCRUMB_COLLAPSE_IMPORTS, BREADCRUMB_IMPORTS } from './breadcrumb.imports';
import { BreadcrumbDirective } from './headless';
import { BreadcrumbSeoDirective } from './seo/breadcrumb-seo.directive';

@Component({
  selector: 'et-test-breadcrumb-host',
  template: `
    <et-breadcrumb>
      @for (crumb of crumbs(); track crumb) {
        <ng-template [loading]="crumb === loadingCrumb()" etBreadcrumbItemTemplate>
          <a etBreadcrumbItem href="#">{{ crumb }}</a>
        </ng-template>
      }

      @if (customSeparator()) {
        <ng-template etBreadcrumbSeparator>/</ng-template>
      }
    </et-breadcrumb>
  `,
  imports: [BREADCRUMB_IMPORTS],
})
class BreadcrumbHostComponent {
  public breadcrumb = viewChild.required(BreadcrumbComponent, { read: BreadcrumbDirective });

  public crumbs = signal(['Home', 'Teams', 'Chemie']);
  public loadingCrumb = signal<string | null>(null);
  public customSeparator = signal(false);
}

const createHost = (): ComponentFixture<BreadcrumbHostComponent> => {
  const fixture = TestBed.createComponent(BreadcrumbHostComponent);
  fixture.detectChanges();

  return fixture;
};

const host = (fixture: ComponentFixture<BreadcrumbHostComponent>) => fixture.nativeElement as HTMLElement;

describe('BreadcrumbComponent', () => {
  it('renders a navigation landmark around an ordered list of crumbs', () => {
    const fixture = createHost();
    const nav = host(fixture).querySelector('et-breadcrumb');

    expect(nav?.getAttribute('role')).toBe('navigation');
    expect(nav?.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(nav?.querySelector('ol')).toBeTruthy();
    expect([...host(fixture).querySelectorAll('.et-breadcrumb-slot')].map((li) => li.textContent?.trim())).toEqual([
      'Home',
      'Teams',
      'Chemie',
    ]);
  });

  it('marks only the last crumb as the current page', () => {
    const fixture = createHost();
    const current = host(fixture).querySelectorAll('[aria-current="page"]');

    expect(current.length).toBe(1);
    expect(current[0]?.textContent?.trim()).toBe('Chemie');
  });

  it('follows the trail when crumbs are added, and keeps aria-current on the new last one', () => {
    const fixture = createHost();

    fixture.componentInstance.crumbs.set(['Home', 'Teams', 'Chemie', 'Squad']);
    fixture.detectChanges();

    expect(fixture.componentInstance.breadcrumb().items().length).toBe(4);
    expect(host(fixture).querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Squad');
  });

  it('renders a separator between crumbs but not after the last one, hidden from assistive tech', () => {
    const fixture = createHost();
    const separators = host(fixture).querySelectorAll('.et-breadcrumb-separator');

    expect(separators.length).toBe(2);
    expect([...separators].every((separator) => separator.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('uses the etBreadcrumbSeparator template when one is projected', () => {
    const fixture = createHost();
    fixture.componentInstance.customSeparator.set(true);
    fixture.detectChanges();

    expect(host(fixture).querySelector('.et-breadcrumb-separator')?.textContent?.trim()).toBe('/');
    expect(host(fixture).querySelector('.et-breadcrumb-chevron')).toBeNull();
  });

  it('renders a placeholder instead of a crumb that is still loading', () => {
    const fixture = createHost();
    fixture.componentInstance.loadingCrumb.set('Teams');
    fixture.detectChanges();

    const slots = host(fixture).querySelectorAll('.et-breadcrumb-slot');

    expect(slots[1]?.querySelector('.et-breadcrumb-loading')).toBeTruthy();
    expect(slots[1]?.textContent).not.toContain('Teams');
  });

  it('takes localized labels from the provider', () => {
    TestBed.configureTestingModule({ providers: [provideBreadcrumbLabels({ navigation: 'Brotkrumen' })] });

    const fixture = createHost();

    expect(host(fixture).querySelector('et-breadcrumb')?.getAttribute('aria-label')).toBe('Brotkrumen');
  });
});

@Component({
  selector: 'et-test-breadcrumb-shell',
  template: `
    <et-breadcrumb-outlet />

    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate>
        <a etBreadcrumbItem href="#">Home</a>
      </ng-template>
    </ng-template>

    @if (showsLayout()) {
      <ng-template etBreadcrumbSegment>
        <ng-template etBreadcrumbItemTemplate>
          <a etBreadcrumbItem href="#">Teams</a>
        </ng-template>
      </ng-template>
    }

    @if (showsLeaf()) {
      <ng-template etBreadcrumbSegment>
        <ng-template etBreadcrumbItemTemplate>
          <span etBreadcrumbItem>Squad</span>
        </ng-template>
      </ng-template>
    }
  `,
  imports: [BREADCRUMB_IMPORTS],
  providers: [provideBreadcrumbManager()],
})
class BreadcrumbShellComponent {
  public outlet = viewChild.required(BreadcrumbOutletComponent);
  public showsLayout = signal(true);
  public showsLeaf = signal(true);
}

describe('BreadcrumbOutletComponent', () => {
  const createShell = () => {
    const fixture = TestBed.createComponent(BreadcrumbShellComponent);
    fixture.detectChanges();

    return fixture;
  };

  const trail = (fixture: ComponentFixture<BreadcrumbShellComponent>) =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('.et-breadcrumb-slot')].map((li) =>
      li.textContent?.trim(),
    );

  it('composes the trail from every registered segment, in registration order', () => {
    const fixture = createShell();

    expect(trail(fixture)).toEqual(['Home', 'Teams', 'Squad']);
  });

  it('marks the last crumb of the composed trail as the current page', () => {
    const fixture = createShell();
    const current = (fixture.nativeElement as HTMLElement).querySelectorAll('[aria-current="page"]');

    expect(current.length).toBe(1);
    expect(current[0]?.textContent?.trim()).toBe('Squad');
  });

  it('drops only the crumbs of a segment whose view is gone, and re-marks the new last crumb', () => {
    const fixture = createShell();

    fixture.componentInstance.showsLeaf.set(false);
    fixture.detectChanges();

    expect(trail(fixture)).toEqual(['Home', 'Teams']);
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-current="page"]')?.textContent?.trim()).toBe(
      'Teams',
    );
  });

  it("keeps the shell's own crumb when every deeper segment is gone", () => {
    const fixture = createShell();

    fixture.componentInstance.showsLayout.set(false);
    fixture.componentInstance.showsLeaf.set(false);
    fixture.detectChanges();

    expect(trail(fixture)).toEqual(['Home']);
  });
});

@Component({
  selector: 'et-test-breadcrumb-collapse-host',
  template: `
    <et-breadcrumb etBreadcrumbCollapse>
      <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem href="#">Home</a></ng-template>
      <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem href="#">Teams</a></ng-template>
      <ng-template etBreadcrumbItemTemplate><span etBreadcrumbItem>Chemie</span></ng-template>
    </et-breadcrumb>
  `,
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_COLLAPSE_IMPORTS],
})
class BreadcrumbCollapseHostComponent {
  public breadcrumb = viewChild.required(BreadcrumbComponent, { read: BreadcrumbDirective });
}

describe('breadcrumb collapse', () => {
  it('has no overflow control - and never collapses - without etBreadcrumbCollapse', () => {
    const fixture = createHost();

    expect(fixture.componentInstance.breadcrumb().overflowComponent).toBeNull();
    expect(fixture.componentInstance.breadcrumb().isCollapsed()).toBe(false);
  });

  it('takes the overflow control from etBreadcrumbCollapse', () => {
    const fixture = TestBed.createComponent(BreadcrumbCollapseHostComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.breadcrumb().overflowComponent).toBe(BreadcrumbOverflowComponent);
  });
});

@Component({
  selector: 'et-test-breadcrumb-seo-shell',
  template: `
    <et-breadcrumb-outlet etBreadcrumbSeo />

    <ng-template etBreadcrumbSegment>
      <ng-template etBreadcrumbItemTemplate name="Home" url="https://example.com/">
        <a etBreadcrumbItem href="#">Home</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate name="Teams">
        <span etBreadcrumbItem>Teams</span>
      </ng-template>
    </ng-template>
  `,
  imports: [BREADCRUMB_IMPORTS, BreadcrumbSeoDirective],
  providers: [provideBreadcrumbManager()],
})
class BreadcrumbSeoShellComponent {
  public seo = viewChild.required(BreadcrumbSeoDirective);
}

describe('BreadcrumbSeoDirective on the outlet', () => {
  it('reads the trail from the manager instead of crashing', () => {
    const fixture = TestBed.createComponent(BreadcrumbSeoShellComponent);
    fixture.detectChanges();

    const data = fixture.componentInstance.seo().structuredData();

    expect(data?.itemListElement.map((item) => item.name)).toEqual(['Home', 'Teams']);
  });
});
