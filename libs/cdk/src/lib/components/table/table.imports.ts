import { TableComponent } from './components/table';
import { CellDirective } from './partials/cells/cell';
import { CellDefDirective } from './partials/cells/cell-def';
import { ColumnDefDirective } from './partials/cells/column-def';
import { FooterCellDirective } from './partials/cells/footer-cell';
import { FooterCellDefDirective } from './partials/cells/footer-cell-def';
import { HeaderCellDirective } from './partials/cells/header-cell';
import { HeaderCellDefDirective } from './partials/cells/header-cell-def';
import { TextColumnComponent } from './partials/cells/text-column';
import { FooterRowComponent } from './partials/rows/footer-row';
import { FooterRowDefDirective } from './partials/rows/footer-row-def';
import { HeaderRowComponent } from './partials/rows/header-row';
import { HeaderRowDefDirective } from './partials/rows/header-row-def';
import { NoDataRowDirective } from './partials/rows/no-data-row';
import { RecycleRowsDirective } from './partials/rows/recycle-rows';
import { RowComponent } from './partials/rows/row';
import { RowDefDirective } from './partials/rows/row-def';
import { TableBusyDirective } from './partials/table-busy';

export const TableImports = [
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
  TableBusyDirective,
] as const;
