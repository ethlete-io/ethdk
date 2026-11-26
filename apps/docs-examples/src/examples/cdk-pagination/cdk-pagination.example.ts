import { Component, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PaginationImports } from '@ethlete/cdk';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-cdk-pagination-example',
  template: `
    <et-pagination [pageControl]="pageControl" [totalPages]="12" renderAs="buttons" />
    <p>Page {{ page() }} of 12</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PaginationImports, ReactiveFormsModule],
})
export class CdkPaginationExampleComponent {
  public pageControl = new FormControl<number | null>(1);

  public page = toSignal(this.pageControl.valueChanges, { initialValue: this.pageControl.value });
}
