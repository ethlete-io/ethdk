import { Component, input, output, signal, ViewEncapsulation } from '@angular/core';
import { StudioMenuComponent } from '../studio-menu/studio-menu.component';
import { ShellMainComponent, ShellSection } from './shell-main.component';

export type ShellState = {
  product: string;
  products: string[];
  project: string;
  projects: string[];
  panel: 'open' | 'hidden';
};

export type ShellAction =
  | { kind: 'collapse' }
  | { kind: 'section'; section: ShellSection }
  | { kind: 'product'; name: string }
  | { kind: 'allProducts' }
  | { kind: 'project'; name: string }
  | { kind: 'openProject' };

export const SHELL_SAMPLE: ShellState = {
  product: 'studio',
  products: ['studio', 'timetrack', 'docs'],
  project: 'ethlete-sdk',
  projects: ['ethlete-sdk', 'fut-frontend', 'design-playground'],
  panel: 'open',
};

@Component({
  selector: 'ethlete-shell-page',
  template: `
    <ethlete-shell-main
      [section]="section()"
      [product]="shell().product"
      [products]="shell().products"
      [project]="shell().project"
      [projects]="shell().projects"
      [panel]="shell().panel"
      (collapse)="action.emit({ kind: 'collapse' })"
      (sectionChange)="action.emit({ kind: 'section', section: $event })"
      (productChange)="action.emit({ kind: 'product', name: $event })"
      (allProducts)="action.emit({ kind: 'allProducts' })"
      (projectChange)="action.emit({ kind: 'project', name: $event })"
      (openProject)="action.emit({ kind: 'openProject' })"
      fill
    >
      <ethlete-studio-menu [(open)]="menuOpen" shellMainStudio bare />
      <ng-container ngProjectAs="[shellMainSide]"><ng-content select="[shellMainSide]" /></ng-container>
      <ng-content />
    </ethlete-shell-main>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ShellMainComponent, StudioMenuComponent],
  host: { class: 'block size-full' },
})
export class ShellPageComponent {
  public section = input<ShellSection>('System');
  public shell = input<ShellState>(SHELL_SAMPLE);

  public action = output<ShellAction>();

  protected menuOpen = signal(false);
}
