import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RuntimeError } from '@ethlete/core';
import '../../test-helpers';
import { TableCellErrorTooltipDirective } from './table-cell-error-tooltip.directive';
import { TABLE_ERROR_CODES } from './table-errors';

describe('TableCellErrorTooltipDirective', () => {
  it('throws a labelled error when used outside a table', () => {
    @Component({
      template: `<div etTableCellErrorTooltip></div>`,
      imports: [TableCellErrorTooltipDirective],
    })
    class OrphanComponent {}

    expect(() => TestBed.createComponent(OrphanComponent)).toThrow(
      expect.objectContaining({ code: TABLE_ERROR_CODES.FEATURE_OUTSIDE_TABLE }) as unknown as RuntimeError<number>,
    );
  });
});
