import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { BracketComponent } from '../../components';
import { RoundWithMatchesView } from '../../components/bracket/bracket.component.types';

@Component({
  selector: 'et-sb-bracket',
  template: `<et-bracket
    [itemHeight]="itemHeight"
    [itemWith]="itemWith"
    [columnGap]="columnGap"
    [rowGap]="rowGap"
    [roundsWithMatches]="roundsWithMatches"
  ></et-bracket>`,
  styles: [
    `
      .et-bracket-match {
        background-color: rgb(101, 101, 101);
        border-radius: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        font-size: 10px;
      }

      .et-bracket-round {
        font-size: 10px;
        text-align: center;
      }
    `,
  ],
  standalone: true,
  imports: [BracketComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StorybookBracketComponent {
  get itemWith() {
    return this._itemWith;
  }
  set itemWith(v: string) {
    this._itemWith = v;
  }
  private _itemWith!: string;

  get itemHeight() {
    return this._itemHeight;
  }
  set itemHeight(v: string) {
    this._itemHeight = v;
  }
  private _itemHeight!: string;

  get columnGap() {
    return this._columnGap;
  }
  set columnGap(v: string) {
    this._columnGap = v;
  }
  private _columnGap!: string;

  get rowGap() {
    return this._rowGap;
  }
  set rowGap(v: string) {
    this._rowGap = v;
  }
  private _rowGap!: string;

  get roundsWithMatches() {
    return this._roundsWithMatches;
  }
  set roundsWithMatches(v: RoundWithMatchesView[] | null | undefined) {
    this._roundsWithMatches = v;
  }
  private _roundsWithMatches!: RoundWithMatchesView[] | null | undefined;
}
