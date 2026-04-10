import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { PIP_CHROME_REF_TOKEN } from './pip-chrome-ref.token';
import { PipCellData } from './pip-chrome-state';

@Directive({
  selector: '[etPipCell]',
  host: {
    class: 'et-stream-pip-chrome__cell',
    '[style.--et-cell-col]': 'cell().col',
    '[style.--et-cell-row]': 'cell().row',
    '[style.--et-cell-exit-h]': 'cell().exitH',
    '[style.--et-cell-exit-v]': 'cell().exitV',
    '[attr.data-cell-player-id]': 'cell().playerId',
    '[class.et-stream-pip-chrome__cell--featured]': 'cell().isFeatured',
    '[attr.inert]': 'cell().inertAttr',
    '[attr.role]': 'cell().gridRole',
    '[attr.tabindex]': 'cell().gridTabIndex',
    '(click)': 'selectCell()',
    '(keydown.enter)': 'selectCell()',
    '(keydown.space)': 'selectCell()',
  },
})
export class PipCellDirective {
  protected chrome = inject(PIP_CHROME_REF_TOKEN);

  cell = input.required<PipCellData>({ alias: 'etPipCell' });

  constructor() {
    const elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
    const el = elementRef.nativeElement;

    effect(() => {
      const playerId = this.cell().playerId;
      this.chrome.state.registerCell(playerId, el);

      return () => this.chrome.state.unregisterCell(playerId);
    });
  }

  selectCell() {
    this.chrome.animations.selectCell(this.cell().playerId);
  }
}
