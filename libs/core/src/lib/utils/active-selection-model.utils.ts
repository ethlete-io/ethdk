import { DOWN_ARROW, END, HOME, PAGE_DOWN, PAGE_UP, UP_ARROW } from '@angular/cdk/keycodes';
import { BehaviorSubject, map, of, switchMap, takeUntil, tap } from 'rxjs';
import { createDestroy } from './destroy.utils';
import { SelectionModel } from './selection-model.utils';

export class ActiveSelectionModel<T = unknown> {
  private readonly _destroy$ = createDestroy();

  get selectionModel$() {
    return this._selectionModel$.asObservable();
  }
  get selectionModel() {
    return this._selectionModel$.value;
  }
  private readonly _selectionModel$ = new BehaviorSubject<SelectionModel<T> | null>(null);

  get activeOption$() {
    return this._activeOption$.asObservable();
  }
  get activeOption() {
    return this._activeOption$.value;
  }
  private readonly _activeOption$ = new BehaviorSubject<T | null>(null);

  constructor() {
    this._selectionModel$
      .pipe(
        takeUntil(this._destroy$),
        switchMap((model) => model?.filteredOptions$ ?? of([])),
        tap(() => this._resetActiveOptions()),
      )
      .subscribe();
  }

  setSelectionModel(selectionModel: SelectionModel<T> | null) {
    this._selectionModel$.next(selectionModel);

    return this;
  }

  setActiveOption(option: T | null) {
    this._activeOption$.next(option);

    return this;
  }

  isOptionActive$(option: T) {
    return this.activeOption$.pipe(map((activeOption) => activeOption === option));
  }

  evaluateKeyboardEvent(event: KeyboardEvent, config?: { skipDisabled?: boolean }) {
    const { skipDisabled = false } = config ?? {};

    const keyCode = event.keyCode;
    const activeOption = this.activeOption;

    if (!this.selectionModel || !activeOption) return null;

    const currentIndex = this.selectionModel?.getOptionIndex(activeOption);

    if (currentIndex === null) return null;

    let newActiveOption: T | null | undefined = undefined;

    switch (keyCode) {
      case DOWN_ARROW:
        {
          newActiveOption = this.selectionModel?.getOptionByOffset(1, currentIndex, { skipDisabled });
        }
        break;
      case UP_ARROW:
        {
          newActiveOption = this.selectionModel?.getOptionByOffset(-1, currentIndex, { skipDisabled });
        }
        break;
      case PAGE_UP:
        {
          newActiveOption = this.selectionModel?.getOptionByOffset(-10, currentIndex, { skipDisabled, clamp: true });
        }
        break;
      case PAGE_DOWN:
        {
          newActiveOption = this.selectionModel?.getOptionByOffset(10, currentIndex, { skipDisabled, clamp: true });
        }
        break;
      case HOME:
        {
          newActiveOption = this.selectionModel?.getFirstOption();
        }
        break;
      case END:
        {
          newActiveOption = this.selectionModel?.getLastOption();
        }
        break;
    }

    if (newActiveOption !== undefined) {
      event.preventDefault();
    }

    if (newActiveOption !== activeOption && newActiveOption) {
      this._activeOption$.next(newActiveOption);
    }

    return newActiveOption ?? null;
  }

  private _resetActiveOptions() {
    const firstOption = this.selectionModel?.getFirstOption();

    this._activeOption$.next(firstOption ?? null);
  }
}
