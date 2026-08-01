import { Component, ViewEncapsulation, computed, input, viewChild } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { BREADCRUMB_COLLAPSE_IMPORTS, BREADCRUMB_IMPORTS, BREADCRUMB_SEO_IMPORTS } from '../breadcrumb.imports';
import { BreadcrumbSeoDirective } from '../seo';

@Component({
  selector: 'et-sb-breadcrumb',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <!-- The box is what the breadcrumb measures itself against: narrow it past the trail's natural
           width and the middle crumbs move into the overflow control. -->
      <div [style.max-inline-size.px]="width()">
        <!-- name/url are read only by etBreadcrumbSeo, never rendered: a crumb's content is a template
             with no single text form, and schema.org wants a plain name and an absolute URL. The last
             crumb states no url - it is the page the markup is on. -->
        <et-breadcrumb [collapse]="collapse()" [etBreadcrumbSeo]="seo()" etBreadcrumbCollapse>
          <ng-template etBreadcrumbItemTemplate name="Home" url="https://example.com/">
            <a (click)="stayHere($event)" etBreadcrumbItem href="#">Home</a>
          </ng-template>
          <ng-template etBreadcrumbItemTemplate name="Competitions" url="https://example.com/competitions">
            <a (click)="stayHere($event)" etBreadcrumbItem href="#">Competitions</a>
          </ng-template>
          <ng-template
            etBreadcrumbItemTemplate
            name="Regionalliga Nordost"
            url="https://example.com/competitions/rl-nordost"
          >
            <a (click)="stayHere($event)" etBreadcrumbItem href="#">Regionalliga Nordost</a>
          </ng-template>
          <ng-template etBreadcrumbItemTemplate name="Matchday 14" url="https://example.com/competitions/rl-nordost/14">
            <a (click)="stayHere($event)" etBreadcrumbItem href="#">Matchday 14</a>
          </ng-template>
          <ng-template [loading]="loading()" etBreadcrumbItemTemplate name="Chemie Leipzig vs. Lok">
            <span etBreadcrumbItem>Chemie Leipzig vs. Lok</span>
          </ng-template>

          @if (separator() === 'slash') {
            <ng-template etBreadcrumbSeparator>/</ng-template>
          }
        </et-breadcrumb>
      </div>

      <p class="text-small">
        Drag the <code>width</code> control down: the trail collapses to first + overflow + last as soon as it stops
        fitting, and expands again once there is room for all of it.
      </p>

      @if (seo()) {
        <div class="text-small flex flex-col gap-2">
          <p>
            <code>etBreadcrumbSeo</code> emitted this <code>BreadcrumbList</code> into the document - the whole trail,
            not the collapsed one, since collapsing is a layout decision.
          </p>
          <pre class="overflow-x-auto rounded-lg p-4" style="background: var(--et-surface-background-solid)">{{
            emittedJsonLd()
          }}</pre>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BREADCRUMB_IMPORTS, BREADCRUMB_COLLAPSE_IMPORTS, BREADCRUMB_SEO_IMPORTS, ProvideSurfaceDirective],
})
export class BreadcrumbStorybookComponent {
  public surface = input('dark');
  public width = input(640);
  public collapse = input(true);
  public loading = input(false);
  public separator = input<'chevron' | 'slash'>('chevron');
  public seo = input(false);

  private seoDirective = viewChild(BreadcrumbSeoDirective);

  /** Exactly what the directive puts in the document, read off it rather than rebuilt here. */
  protected emittedJsonLd = computed(() => {
    const data = this.seoDirective()?.structuredData() ?? null;

    return data ? JSON.stringify(data, null, 2) : 'nothing emitted';
  });

  // Real crumbs are `routerLink`s (see the routed story); these are hrefs only so they behave like links
  // without a route to go to, so the demo swallows the navigation.
  protected stayHere(event: Event) {
    event.preventDefault();
  }
}
