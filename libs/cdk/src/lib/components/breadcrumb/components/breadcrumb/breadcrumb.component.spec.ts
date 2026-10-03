import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BreadcrumbItemTemplateDirective } from '../../directives/breadcrumb-item-template.directive';
import { BreadcrumbComponent } from './breadcrumb.component';

const scrollState = signal({ canScrollHorizontally: true });

vi.mock('@ethlete/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ethlete/core')>()),
  signalHostElementScrollState: () => scrollState,
}));

@Component({
  template: `
    <et-breadcrumb>
      @for (item of items; track item) {
        <span *etBreadcrumbItemTemplate>{{ item }}</span>
      }
    </et-breadcrumb>
  `,
  imports: [BreadcrumbComponent, BreadcrumbItemTemplateDirective],
})
class HostComponent {
  items = ['Home', 'Page'];
}

describe('BreadcrumbComponent', () => {
  it('stops collapsing at the item count when there are fewer items than the minimum', async () => {
    const fixture = TestBed.createComponent(HostComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    const breadcrumb = fixture.debugElement.children[0]?.componentInstance as BreadcrumbComponent;

    expect(breadcrumb.visibleElementCount()).toBe(2);
    expect(breadcrumb.itemsToRender()?.map((i) => i.type)).toEqual(['breadcrumb', 'breadcrumb']);
  });
});
