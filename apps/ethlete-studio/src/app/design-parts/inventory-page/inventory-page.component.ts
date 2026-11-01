import { Component, input, model, output, ViewEncapsulation } from '@angular/core';
import { PartTreeComponent, PartTreeLayer } from '../part-tree/part-tree.component';
import { ShellMainComponent, ShellSection } from '../shell-main/shell-main.component';
import { StudioMenuComponent } from '../studio-menu/studio-menu.component';

export type InventoryPageState = 'open' | 'approvable' | 'approved' | 'loading';

export const INVENTORY_PAGE_TREE: PartTreeLayer[] = [
  { title: 'Foundations', open: false, parts: [] },
  { title: 'Elements', open: false, parts: [] },
  { title: 'Components', open: false, parts: [] },
  {
    title: 'Pages',
    open: true,
    parts: [{ name: 'flows', leaf: true, selected: true }, { name: 'inbox' }, { name: 'system' }],
  },
];

@Component({
  selector: 'ethlete-inventory-page',
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
      section="System"
    >
      <ethlete-studio-menu [(open)]="menuOpen" shellMainStudio bare />
      <div class="-m-space-2 h-[calc(100%+var(--space-2)*2)] overflow-y-auto" shellMainSide>
        <ethlete-part-tree [layers]="tree()" (activate)="pick.emit($event)" />
      </div>
      <ng-content />
    </ethlete-shell-main>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ShellMainComponent, StudioMenuComponent, PartTreeComponent],
  host: { class: 'block h-screen w-full' },
})
export class InventoryPageComponent {
  public inventory = input<InventoryPageState>('open');
  public tree = input(INVENTORY_PAGE_TREE);
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
}
