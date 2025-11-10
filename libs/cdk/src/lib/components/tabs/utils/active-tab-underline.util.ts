import {
  Directive,
  ElementRef,
  InjectionToken,
  Input,
  OnDestroy,
  OnInit,
  booleanAttribute,
  inject,
} from '@angular/core';
import { TypedQueryList } from '@ethlete/core';

export interface ActiveTabUnderlineItem extends OnInit, OnDestroy {
  elementRef: ElementRef<HTMLElement>;
  activateUnderline(previousIndicatorClientRect?: DOMRect): void;
  deactivateUnderline(): void;
  fitUnderlineToContent: boolean;
}

const ACTIVE_CLASS = 'et-active-tab-underline--active';

const NO_TRANSITION_CLASS = 'et-active-tab-underline--no-transition';

export class ActiveTabUnderlineBarManager {
  private _currentItem: ActiveTabUnderlineItem | undefined;

  constructor(private _items: TypedQueryList<ActiveTabUnderlineItem>) {}

  hide() {
    this._items.forEach((item) => item?.deactivateUnderline());
  }

  alignToElement(element: HTMLElement) {
    const correspondingItem = this._items.find((item) => item?.elementRef.nativeElement === element);
    const currentItem = this._currentItem;

    currentItem?.deactivateUnderline();

    if (correspondingItem) {
      const clientRect = currentItem?.elementRef.nativeElement.getBoundingClientRect?.();

      correspondingItem.activateUnderline(clientRect);
      this._currentItem = correspondingItem;
    }
  }
}

@Directive({})
export class ActiveTabUnderlineDirective implements OnInit, OnDestroy {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private _underlineElement: HTMLElement | null = null;
  private _underlineContentElement: HTMLElement | null = null;

  @Input()
  get fitUnderlineToContent(): boolean {
    return this._fitToContent;
  }
  set fitUnderlineToContent(v: unknown) {
    const newValue = booleanAttribute(v);

    if (this._fitToContent !== newValue) {
      this._fitToContent = newValue;

      if (this._underlineElement) {
        this._appendUnderlineElement();
      }
    }
  }
  private _fitToContent = false;

  activateUnderline(previousIndicatorClientRect?: DOMRect) {
    const element = this.elementRef.nativeElement;

    if (!previousIndicatorClientRect || !element.getBoundingClientRect || !this._underlineContentElement) {
      element.classList.add(ACTIVE_CLASS);
      return;
    }

    const currentClientRect = element.getBoundingClientRect();
    const widthDelta = previousIndicatorClientRect.width / currentClientRect.width;
    const xPosition = previousIndicatorClientRect.left - currentClientRect.left;
    const heightDelta = previousIndicatorClientRect.height / currentClientRect.height;
    const yPosition = previousIndicatorClientRect.top - currentClientRect.top;
    element.classList.add(NO_TRANSITION_CLASS);
    this._underlineContentElement.style.setProperty(
      'transform',
      `translateX(${xPosition}px) translateY(${yPosition}px) scaleX(${widthDelta}) scaleY(${heightDelta})`,
    );

    element.getBoundingClientRect();

    element.classList.remove(NO_TRANSITION_CLASS);
    element.classList.add(ACTIVE_CLASS);
    this._underlineContentElement.style.setProperty('transform', '');
  }

  deactivateUnderline() {
    this.elementRef.nativeElement.classList.remove(ACTIVE_CLASS);
  }

  ngOnInit() {
    this._createUnderlineElement();
  }

  ngOnDestroy() {
    this._underlineElement?.remove();
    this._underlineElement = this._underlineContentElement = null;
  }

  private _createUnderlineElement() {
    const documentNode = this.elementRef.nativeElement.ownerDocument || document;
    this._underlineElement = documentNode.createElement('span');
    this._underlineContentElement = documentNode.createElement('span');

    this._underlineElement.className = 'et-active-tab-underline';
    this._underlineContentElement.className =
      'et-active-tab-underline__content et-active-tab-underline__content--underline';

    this._underlineElement.appendChild(this._underlineContentElement);
    this._appendUnderlineElement();
  }

  private _appendUnderlineElement() {
    if (!this._underlineElement) {
      return;
    }

    const parentElement = this._fitToContent
      ? this.elementRef.nativeElement.querySelector('.et-tab-content')
      : this.elementRef.nativeElement;

    if (!parentElement) {
      return;
    }

    parentElement.appendChild(this._underlineElement);
  }
}

export interface _ActiveTabUnderlinePositioner {
  (element: HTMLElement): { left: string; width: string };
}

export function _MAT_INK_BAR_POSITIONER_FACTORY(): _ActiveTabUnderlinePositioner {
  const method = (element: HTMLElement) => ({
    left: element ? (element.offsetLeft || 0) + 'px' : '0',
    width: element ? (element.offsetWidth || 0) + 'px' : '0',
  });

  return method;
}

export const _MAT_INK_BAR_POSITIONER = new InjectionToken<_ActiveTabUnderlinePositioner>(
  'ET_ACTIVE_TAB_UNDERLINE_POSITIONER',
  {
    providedIn: 'root',
    factory: _MAT_INK_BAR_POSITIONER_FACTORY,
  },
);
