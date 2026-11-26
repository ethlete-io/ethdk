import { CdkCellDef } from '@angular/cdk/table';
import { Directive } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etCellDef]',
  providers: [{ provide: CdkCellDef, useExisting: CellDefDirective }],
})
export class CellDefDirective extends CdkCellDef {}
