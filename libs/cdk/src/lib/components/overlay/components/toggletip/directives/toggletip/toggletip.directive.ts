import {
  DOCUMENT,
  Directive,
  EventEmitter,
  InjectionToken,
  Input,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  booleanAttribute,
  inject,
} from '@angular/core';
import { AnimatedOverlayDirective, createDestroy, nextFrame } from '@ethlete/core';
import { Subscription, filter, fromEvent, takeUntil, tap } from 'rxjs';
import { THEME_PROVIDER } from '../../../../../../theming';
import { OverlayCloseBlockerDirective } from '../../../../directives/overlay-close-auto-blocker';
import { ToggletipComponent } from '../../components/toggletip';
import { TOGGLETIP_CONFIG, TOGGLETIP_TEMPLATE, TOGGLETIP_TEXT } from '../../constants';
import { ToggletipConfig } from '../../types';
import { createToggletipConfig } from '../../utils';

type ToggletipTemplate = string | TemplateRef<unknown>;

export const TOGGLETIP_DIRECTIVE = new InjectionToken<ToggletipDirective>('TOGGLETIP_DIRECTIVE');

@Directive({
  selector: '[etToggletip]',

  providers: [
    {
      provide: TOGGLETIP_DIRECTIVE,
      useExisting: ToggletipDirective,
    },
  ],
  hostDirectives: [{ directive: AnimatedOverlayDirective, inputs: ['placement'] }, OverlayCloseBlockerDirective],
})
export class ToggletipDirective implements OnInit, OnDestroy {
  private readonly _destroy$ = createDestroy();
  private readonly _defaultConfig =
    inject<ToggletipConfig>(TOGGLETIP_CONFIG, { optional: true }) ?? createToggletipConfig();
  readonly _animatedOverlay = inject<AnimatedOverlayDirective<ToggletipComponent>>(AnimatedOverlayDirective);
  private readonly _themeProvider = inject(THEME_PROVIDER, { optional: true });
  private document = inject(DOCUMENT);

  @Input('etToggletip')
  get toggletip() {
    return this._toggletip;
  }
  set toggletip(v: ToggletipTemplate | null) {
    this._toggletip = v;
  }
  private _toggletip: ToggletipTemplate | null = null;

  @Input()
  get showToggletip(): boolean {
    return this._showToggletip;
  }
  set showToggletip(value: unknown) {
    this._showToggletip = booleanAttribute(value);

    if (this._showToggletip && !this._animatedOverlay.isMounted) {
      nextFrame(() => {
        this._mountToggletip();
        this._addListeners();
      });
    } else if (!this._showToggletip && this._animatedOverlay.isMounted) {
      this._animatedOverlay.unmount();
      this._removeListeners();
    }
  }
  private _showToggletip = false;

  @Output()
  toggletipClose = new EventEmitter();

  private readonly _listenerSubscriptions: Subscription[] = [];

  constructor() {
    this._animatedOverlay.placement = this._defaultConfig.placement;
    this._animatedOverlay.offset = this._defaultConfig.offset;
    this._animatedOverlay.viewportPadding = this._defaultConfig.viewportPadding;
    this._animatedOverlay.arrowPadding = this._defaultConfig.arrowPadding;
    this._animatedOverlay.autoCloseIfReferenceHidden = true;
  }

  ngOnInit(): void {
    this._animatedOverlay
      .afterClosed()
      .pipe(
        tap(() => {
          this._removeListeners();
          this.toggletipClose.emit();
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._animatedOverlay._destroy();
    this._removeListeners();
  }

  private _addListeners() {
    const keyupEscSub = fromEvent<KeyboardEvent>(document, 'keyup')
      .pipe(
        filter((e) => e.key === 'Escape'),
        tap(() => this._animatedOverlay.unmount()),
      )
      .subscribe();

    const clickOutsideSub = fromEvent<MouseEvent>(this.document.documentElement, 'click').subscribe((e) => {
      const targetElement = e.target as HTMLElement;
      const isInside = this._animatedOverlay.componentRef?.location.nativeElement.contains(targetElement);

      if (!isInside) {
        this._animatedOverlay.unmount();
      }
    });

    this._listenerSubscriptions.push(keyupEscSub, clickOutsideSub);
  }

  private _removeListeners() {
    this._listenerSubscriptions.forEach((s) => s.unsubscribe());
    this._listenerSubscriptions.length = 0;
  }

  private _mountToggletip() {
    this._animatedOverlay.mount({
      component: ToggletipComponent,
      themeProvider: this._themeProvider,
      providers: [
        {
          provide: TOGGLETIP_CONFIG,
          useValue: this._defaultConfig,
        },
        ...[
          typeof this.toggletip === 'string'
            ? {
                provide: TOGGLETIP_TEXT,
                useValue: this.toggletip,
              }
            : {
                provide: TOGGLETIP_TEMPLATE,
                useValue: this.toggletip,
              },
        ],
      ],
    });
  }
}
