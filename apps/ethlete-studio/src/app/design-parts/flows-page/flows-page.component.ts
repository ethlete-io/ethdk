import { Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { ShellMainComponent, ShellSection } from '../shell-main/shell-main.component';
import { StudioMenuComponent } from '../studio-menu/studio-menu.component';
import { TreeRow, TreeRowItemComponent } from '../tree-row/tree-row-item.component';

export const FLOWS_SAMPLE = ['Sketch prüfen', 'Kommentar beantworten', 'Produkt anlegen'];

@Component({
  selector: 'ethlete-flows-page',
  template: `
    <ethlete-shell-main
      [product]="product()"
      [products]="products()"
      [project]="project()"
      [projects]="projects()"
      [panel]="panel()"
      (collapse)="collapse.emit()"
      (sectionChange)="sectionChange.emit($event)"
      (productChange)="productChange.emit($event)"
      (allProducts)="allProducts.emit()"
      (projectChange)="projectChange.emit($event)"
      (openProject)="openProject.emit()"
      fill
      section="Flows"
    >
      <ethlete-studio-menu [(open)]="menuOpen" shellMainStudio bare />
      <div class="-m-space-2 h-[calc(100%+var(--space-2)*2)] overflow-y-auto p-space-2" shellMainSide>
        @if (rows().length) {
          <div class="flex flex-col gap-px" role="tree">
            @for (row of rows(); track row.label) {
              <div
                [item]="row"
                [attr.aria-level]="1"
                [attr.aria-selected]="row.selected"
                (click)="pick.emit(row.label)"
                (keydown.enter)="pick.emit(row.label)"
                ethlete-tree-row-item
                role="treeitem"
                tabindex="0"
              ></div>
            }
          </div>
        } @else {
          <p class="m-0 px-space-3 py-space-2 text-ui-sm text-et-surface-muted">{{ LABELS.none }}</p>
        }
      </div>
      <ng-content />
    </ethlete-shell-main>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ShellMainComponent, StudioMenuComponent, TreeRowItemComponent],
  host: { class: 'block h-screen w-full' },
})
export class FlowsPageComponent {
  public flow = input<'open' | 'none'>('open');
  public flows = input(FLOWS_SAMPLE);
  public selected = input(FLOWS_SAMPLE[0]);
  public product = input('studio');
  public products = input(['studio', 'timetrack', 'docs']);
  public project = input('ethlete-sdk');
  public projects = input(['ethlete-sdk', 'fut-frontend', 'design-playground']);
  public panel = input<'open' | 'hidden'>('open');
  public menuOpen = model(false);

  public pick = output<string>();
  public collapse = output();
  public sectionChange = output<ShellSection>();
  public productChange = output<string>();
  public allProducts = output();
  public projectChange = output<string>();
  public openProject = output();

  protected readonly LABELS = STUDIO_LABELS.flows;

  protected rows = computed<TreeRow[]>(() =>
    this.flow() === 'none'
      ? []
      : this.flows().map((label) => ({ label, depth: 0, kind: 'leaf', selected: label === this.selected() })),
  );
}
