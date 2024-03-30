import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FocusVisibleService {
  private readonly _document = inject(DOCUMENT);

  private _hadKeyboardEvent = false;

  get isFocusVisible() {
    return this._hadKeyboardEvent;
  }

  constructor() {
    this._document.addEventListener('keydown', this.onKeyDown.bind(this), true);
    this._document.addEventListener('mousedown', this.onPointerDown.bind(this), true);
    this._document.addEventListener('pointerdown', this.onPointerDown.bind(this), true);
    this._document.addEventListener('touchstart', this.onPointerDown.bind(this), true);
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.metaKey || e.altKey || e.ctrlKey) {
      return;
    }

    this._hadKeyboardEvent = true;
  }

  onPointerDown() {
    this._hadKeyboardEvent = false;
  }
}
