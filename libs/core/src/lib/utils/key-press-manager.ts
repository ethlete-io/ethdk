import { BehaviorSubject, Subject, takeUntil, timer } from 'rxjs';

export class KeyPressManager {
  private readonly _isKeyPressed$ = new BehaviorSubject(false);
  private readonly _keyPressCount$ = new BehaviorSubject(0);

  private readonly _stopTimeout$ = new Subject<void>();

  constructor(public readonly key: number) {}

  isPressed(event: KeyboardEvent) {
    const key = event.keyCode;

    if (key === this.key) {
      this._isKeyPressed$.next(this._keyPressCount$.value > 1);
      this._keyPressCount$.next(this._keyPressCount$.value + 1);

      this._stopTimeout$.next();

      timer(100)
        .pipe(takeUntil(this._stopTimeout$))
        .subscribe(() => this.clear());
    } else {
      this.clear();
    }

    return this._isKeyPressed$.value;
  }

  clear() {
    this._isKeyPressed$.next(false);
    this._keyPressCount$.next(0);
    this._stopTimeout$.next();
  }
}
