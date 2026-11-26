import { Component, ViewEncapsulation, computed, viewChild } from '@angular/core';
import { BREADCRUMB_IMPORTS, BREADCRUMB_SEO_IMPORTS, BreadcrumbSeoDirective } from '@ethlete/components';

@Component({
  selector: 'app-breadcrumb-structured-data-example',
  template: `
    <et-breadcrumb etBreadcrumbSeo>
      <ng-template etBreadcrumbItemTemplate name="Home" url="https://example.com/">
        <a etBreadcrumbItem href="#home">Home</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate name="Competitions" url="https://example.com/competitions">
        <a etBreadcrumbItem href="#competitions">Competitions</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate name="Matchday 14" url="https://example.com/competitions/rl-nordost/14">
        <a etBreadcrumbItem href="#matchday-14">Matchday 14</a>
      </ng-template>
      <ng-template etBreadcrumbItemTemplate name="Chemie Leipzig vs. Lok">
        <span etBreadcrumbItem>Chemie Leipzig vs. Lok</span>
      </ng-template>
    </et-breadcrumb>

    <pre>{{ emittedJsonLd() }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_SEO_IMPORTS],
})
export class BreadcrumbStructuredDataExampleComponent {
  private seo = viewChild(BreadcrumbSeoDirective);

  protected emittedJsonLd = computed(() => {
    const data = this.seo()?.structuredData() ?? null;

    return data ? JSON.stringify(data, null, 2) : 'nothing emitted';
  });
}
