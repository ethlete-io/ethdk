import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { BREADCRUMB_IMPORTS, BREADCRUMB_SEO_IMPORTS } from '../breadcrumb.imports';

@Component({
  template: `
    <et-breadcrumb etBreadcrumbSeo>
      <ng-template etBreadcrumbItemTemplate name="Home" url="https://example.com/">
        <a etBreadcrumbItem href="/">Home</a>
      </ng-template>
      <ng-template [name]="teamsName()" etBreadcrumbItemTemplate url="https://example.com/teams">
        <a etBreadcrumbItem href="/teams">Teams</a>
      </ng-template>
      <ng-template [name]="lastName()" [loading]="loading()" etBreadcrumbItemTemplate>
        <span etBreadcrumbItem>{{ lastName() }}</span>
      </ng-template>
    </et-breadcrumb>
  `,
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_SEO_IMPORTS],
})
class HostComponent {
  public teamsName = signal<string | null>('Teams');
  public lastName = signal<string | null>('Rockets');
  public loading = signal(false);
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return fixture;
};

/** The emitted JSON-LD, parsed — the store appends one script per binding. */
const emitted = (): { itemListElement: { position: number; name: string; item?: string }[] } | null => {
  const script = document.querySelector('script[type="application/ld+json"]');

  return script?.textContent ? JSON.parse(script.textContent) : null;
};

const settle = (fixture: ComponentFixture<HostComponent>) => {
  fixture.detectChanges();

  return emitted();
};

afterEach(() => {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) script.remove();
});

describe('BreadcrumbSeoDirective', () => {
  it('emits a BreadcrumbList for the trail', () => {
    const data = settle(create());

    expect(data).toMatchObject({ '@context': 'https://schema.org', '@type': 'BreadcrumbList' });
    expect(data?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
      { '@type': 'ListItem', position: 2, name: 'Teams', item: 'https://example.com/teams' },
      // No `item` on the last crumb: it is the page the markup is on.
      { '@type': 'ListItem', position: 3, name: 'Rockets' },
    ]);
  });

  it('skips a crumb that is still loading rather than naming a placeholder', () => {
    const fixture = create();

    fixture.componentInstance.loading.set(true);

    expect(settle(fixture)?.itemListElement.map((item) => item.name)).toEqual(['Home', 'Teams']);
  });

  it('skips a crumb that states no name — it has nothing to contribute', () => {
    const fixture = create();

    fixture.componentInstance.teamsName.set(null);

    expect(settle(fixture)?.itemListElement.map((item) => item.name)).toEqual(['Home', 'Rockets']);
  });

  it('renumbers positions after a skip, so the list stays 1..n', () => {
    const fixture = create();

    fixture.componentInstance.teamsName.set(null);

    expect(settle(fixture)?.itemListElement.map((item) => item.position)).toEqual([1, 2]);
  });

  it('emits nothing for a trail of fewer than two named crumbs', () => {
    const fixture = create();

    fixture.componentInstance.teamsName.set(null);
    fixture.componentInstance.lastName.set(null);

    expect(settle(fixture)).toBeNull();
  });

  it('emits nothing while disabled, so it can be gated per page', () => {
    TestBed.overrideTemplate(
      HostComponent,
      `<et-breadcrumb [etBreadcrumbSeo]="false">
         <ng-template etBreadcrumbItemTemplate name="Home" url="https://example.com/"><span etBreadcrumbItem>Home</span></ng-template>
         <ng-template etBreadcrumbItemTemplate name="Teams"><span etBreadcrumbItem>Teams</span></ng-template>
       </et-breadcrumb>`,
    );

    expect(settle(create())).toBeNull();
  });

  it('follows a name that arrives late', () => {
    const fixture = create();

    fixture.componentInstance.lastName.set('Rockets 2024');

    expect(settle(fixture)?.itemListElement.at(-1)?.name).toBe('Rockets 2024');
  });
});
