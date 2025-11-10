import { _RecycleViewRepeaterStrategy, _VIEW_REPEATER_STRATEGY } from '@angular/cdk/collections';
import { Directive } from '@angular/core';

@Directive({
  selector: 'et-table[recycleRows], table[et-table][recycleRows]',
  providers: [{ provide: _VIEW_REPEATER_STRATEGY, useClass: _RecycleViewRepeaterStrategy }],
})
export class RecycleRowsDirective {}
