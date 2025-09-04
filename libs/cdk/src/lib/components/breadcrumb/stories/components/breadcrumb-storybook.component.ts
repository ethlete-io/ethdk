import { ChangeDetectionStrategy, Component, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { BreadcrumbImports } from '../../breadcrumb.imports';

@Component({
  selector: 'et-sb-breadcrumb',
  template: `
    <et-breadcrumb-outlet />
    <router-outlet />
  `,
  imports: [RouterModule, BreadcrumbImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StorybookBreadcrumbComponent implements OnInit {
  private router = inject(Router);

  ngOnInit(): void {
    this.router.navigate(['./five']);
  }
}
