import { Subject, takeUntil, timer } from 'rxjs';

export class KeyPressManager {
  private isKeyPressed = false;
  private keyPressCount = 0;
  private readonly _stopTimeout$ = new Subject<void>();

  constructor(public readonly key: number) {}

  isPressed(event: KeyboardEvent) {
    const key = event.keyCode;

    if (key === this.key) {
      this.isKeyPressed = this.keyPressCount >= 1;
      this.keyPressCount++;

      this._stopTimeout$.next();

      timer(100)
        .pipe(takeUntil(this._stopTimeout$))
        .subscribe(() => this.clear());
    } else {
      this.clear();
    }

    return this.isKeyPressed;
  }

  clear() {
    this.isKeyPressed = false;
    this.keyPressCount = 0;
    this._stopTimeout$.next();
  }
}
