 
/* eslint-disable @angular-eslint/no-output-rename */
/* eslint-disable @angular-eslint/no-outputs-metadata-property */

/* eslint-disable @angular-eslint/no-inputs-metadata-property */

import { Directionality } from '@angular/cdk/bidi';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayConfig,
  STANDARD_DROPDOWN_BELOW_POSITIONS,
} from '@angular/cdk/overlay';
import { _getEventTarget } from '@angular/cdk/platform';
import { Directive, Injectable, Input, OnDestroy, inject } from '@angular/core';
import { merge, partition } from 'rxjs';
import { skip, takeUntil } from 'rxjs/operators';
import { MENU_STACK, MenuStack } from './menu-stack';
import { CdkMenuTriggerBase, MENU_TRIGGER } from './menu-trigger-base';

const CONTEXT_MENU_POSITIONS = STANDARD_DROPDOWN_BELOW_POSITIONS.map((position) => {
  const offsetX = position.overlayX === 'start' ? 2 : -2;
  const offsetY = position.overlayY === 'top' ? 2 : -2;
  return { ...position, offsetX, offsetY };
});

@Injectable({ providedIn: 'root' })
export class ContextMenuTracker {
  private static _openContextMenuTrigger?: CdkContextMenuTrigger;

  update(trigger: CdkContextMenuTrigger) {
    if (ContextMenuTracker._openContextMenuTrigger !== trigger) {
      ContextMenuTracker._openContextMenuTrigger?.close();
      ContextMenuTracker._openContextMenuTrigger = trigger;
    }
  }
}

export type ContextMenuCoordinates = { x: number; y: number };

/**
 * @deprecated Use the new menu instead
 */
@Directive({
  selector: '[cdkContextMenuTriggerFor]',
  exportAs: 'cdkContextMenuTriggerFor',
  standalone: true,
  host: {
    '[attr.data-cdk-menu-stack-id]': 'null',
    '(contextmenu)': '_openOnContextMenu($event)',
  },
  inputs: [
    'menuTemplateRef: cdkContextMenuTriggerFor',
    'menuPosition: cdkContextMenuPosition',
    'menuData: cdkContextMenuTriggerData',
  ],
  outputs: ['opened: cdkContextMenuOpened', 'closed: cdkContextMenuClosed'],
  providers: [
    { provide: MENU_TRIGGER, useExisting: CdkContextMenuTrigger },
    { provide: MENU_STACK, useClass: MenuStack },
  ],
})
export class CdkContextMenuTrigger extends CdkMenuTriggerBase implements OnDestroy {
  private readonly _overlay = inject(Overlay);

  private readonly _directionality = inject(Directionality, { optional: true });

  private readonly _contextMenuTracker = inject(ContextMenuTracker);

  @Input('cdkContextMenuDisabled')
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(value: BooleanInput) {
    this._disabled = coerceBooleanProperty(value);
  }
  private _disabled = false;

  constructor() {
    super();
    this._setMenuStackCloseListener();
  }

  open(coordinates: ContextMenuCoordinates) {
    this._open(coordinates, false);
  }

  close() {
    this.menuStack.closeAll();
  }

  _openOnContextMenu(event: MouseEvent) {
    if (!this.disabled) {
      event.preventDefault();

      event.stopPropagation();

      this._contextMenuTracker.update(this);
      this._open({ x: event.clientX, y: event.clientY }, true);

      if (event.button === 2) {
        this.childMenu?.focusFirstItem('mouse');
      } else if (event.button === 0) {
        this.childMenu?.focusFirstItem('keyboard');
      } else {
        this.childMenu?.focusFirstItem('program');
      }
    }
  }

  private _getOverlayConfig(coordinates: ContextMenuCoordinates) {
    return new OverlayConfig({
      positionStrategy: this._getOverlayPositionStrategy(coordinates),
      scrollStrategy: this._overlay.scrollStrategies.reposition(),
      direction: this._directionality || undefined,
    });
  }

  private _getOverlayPositionStrategy(coordinates: ContextMenuCoordinates): FlexibleConnectedPositionStrategy {
    return this._overlay
      .position()
      .flexibleConnectedTo(coordinates)
      .withLockedPosition()
      .withGrowAfterOpen()
      .withPositions(this.menuPosition ?? CONTEXT_MENU_POSITIONS);
  }

  private _setMenuStackCloseListener() {
    this.menuStack.closed.pipe(takeUntil(this.destroyed)).subscribe(({ item }) => {
      if (item === this.childMenu && this.isOpen()) {
        this.closed.next();
        this.overlayRef!.detach();
      }
    });
  }

  private _subscribeToOutsideClicks(ignoreFirstAuxClick: boolean) {
    if (this.overlayRef) {
      let outsideClicks = this.overlayRef.outsidePointerEvents();

      if (ignoreFirstAuxClick) {
        const [auxClicks, nonAuxClicks] = partition(outsideClicks, ({ type }) => type === 'auxclick');
        outsideClicks = merge(nonAuxClicks, auxClicks.pipe(skip(1)));
      }
      outsideClicks.pipe(takeUntil(this.stopOutsideClicksListener)).subscribe((event) => {
        if (!this.isElementInsideMenuStack(_getEventTarget(event)!)) {
          this.menuStack.closeAll();
        }
      });
    }
  }

  private _open(coordinates: ContextMenuCoordinates, ignoreFirstOutsideAuxClick: boolean) {
    if (this.disabled) {
      return;
    }
    if (this.isOpen()) {
      this.menuStack.closeSubMenuOf(this.childMenu!);

      (this.overlayRef!.getConfig().positionStrategy as FlexibleConnectedPositionStrategy).setOrigin(coordinates);
      this.overlayRef!.updatePosition();
    } else {
      this.opened.next();

      if (this.overlayRef) {
        (this.overlayRef.getConfig().positionStrategy as FlexibleConnectedPositionStrategy).setOrigin(coordinates);
        this.overlayRef.updatePosition();
      } else {
        this.overlayRef = this._overlay.create(this._getOverlayConfig(coordinates));
      }

      this.overlayRef.attach(this.getMenuContentPortal());
      this._subscribeToOutsideClicks(ignoreFirstOutsideAuxClick);
    }
  }
}
