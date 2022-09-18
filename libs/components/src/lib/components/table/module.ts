import { NgModule } from '@angular/core';
import { RecycleRowsDirective, TableComponent } from './table';
import { CdkTableModule } from '@angular/cdk/table';
import {
  CellDirective,
  CellDefDirective,
  ColumnDefDirective,
  FooterCellDirective,
  FooterCellDefDirective,
  HeaderCellDirective,
  HeaderCellDefDirective,
} from './cell';
import {
  FooterRowComponent,
  FooterRowDefDirective,
  HeaderRowComponent,
  HeaderRowDefDirective,
  RowComponent,
  RowDefDirective,
  NoDataRowDirective,
} from './row';
import { TextColumnComponent } from './text-column';

const EXPORTED_DECLARATIONS = [
  TableComponent,
  RecycleRowsDirective,
  HeaderCellDefDirective,
  HeaderRowDefDirective,
  ColumnDefDirective,
  CellDefDirective,
  RowDefDirective,
  FooterCellDefDirective,
  FooterRowDefDirective,
  HeaderCellDirective,
  CellDirective,
  FooterCellDirective,
  HeaderRowComponent,
  RowComponent,
  FooterRowComponent,
  NoDataRowDirective,
  TextColumnComponent,
];

@NgModule({
  imports: [CdkTableModule],
  exports: [EXPORTED_DECLARATIONS],
  declarations: EXPORTED_DECLARATIONS,
})
export class TableModule {}
