import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { BreadcrumbOutletComponent } from './breadcrumb-outlet.component';
import { provideBreadcrumbLabels } from './breadcrumb-labels';
import { provideBreadcrumbManager } from './breadcrumb-manager';
import { BreadcrumbComponent } from './breadcrumb.component';
import { BREADCRUMB_IMPORTS } from './breadcrumb.imports';
import { BreadcrumbDirective } from './headless';

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
  selector: 'et-test-breadcrumb-outlet-host',
  template: `
    <et-breadcrumb-outlet />

    @if (showsPage()) {
      <ng-template etBreadcrumbTemplate>
        <et-breadcrumb>
          <ng-template etBreadcrumbItemTemplate>
            <span etBreadcrumbItem>Registered</span>
          </ng-template>
        </et-breadcrumb>
      </ng-template>
    }
  `,
  imports: [BREADCRUMB_IMPORTS],
  providers: [provideBreadcrumbManager()],
})
class BreadcrumbOutletHostComponent {
  public outlet = viewChild.required(BreadcrumbOutletComponent);
  public showsPage = signal(true);
}

describe('BreadcrumbOutletComponent', () => {
  it('renders the registered trail, and nothing once the page that registered it is gone', () => {
    const fixture = TestBed.createComponent(BreadcrumbOutletHostComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('et-breadcrumb')?.textContent?.trim()).toBe('Registered');

    fixture.componentInstance.showsPage.set(false);
    fixture.detectChanges();

    expect(element.querySelector('et-breadcrumb')).toBeNull();
  });
});
