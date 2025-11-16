import { coerceElement } from '@angular/cdk/coercion';
import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  TrackByFunction,
  ViewEncapsulation,
  booleanAttribute,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { BehaviorSubject, Subscription } from 'rxjs';
import { PaginationLinkDirective } from '../../partials/pagination-link';
import { PaginationHeadService } from '../../services';
import { PaginationItem } from '../../types';
import { paginate } from '../../utils';

@Component({
  selector: 'et-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, PaginationLinkDirective],
  providers: [PaginationHeadService],
  host: {
    class: 'et-pagination',
  },
})
export class PaginationComponent implements OnInit, OnDestroy {
  private _pageControlSubscription = Subscription.EMPTY;
  private _paginationHeadService = inject(PaginationHeadService);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input({ required: true })
  get pageControl() {
    return this._pageControl;
  }
  set pageControl(v: FormControl<number | null> | null) {
    this._pageControl = v;
    this._updatePages();
    this._subscribeToPageControlChanges();
  }
  private _pageControl: FormControl<number | null> | null = null;

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input({ required: true })
  get totalPages(): number {
    return this._totalPages;
  }
  set totalPages(value: unknown) {
    this._totalPages = numberAttribute(value, 0);
    this._updatePages();
  }
  private _totalPages = 0;

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  set headTitleTemplate(v: string | null) {
    this._paginationHeadService.titleTemplate = v;
    this._updateHead();
  }

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  set headFirstPageTitle(v: string | null) {
    this._paginationHeadService.firstPageTitle = v;
    this._updateHead();
  }

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input({ transform: booleanAttribute })
  set headAddCanonicalTag(v: boolean) {
    this._paginationHeadService.addCanonicalTag = v;
    this._updateHead();
  }

  readonly ariaLabel = input('Pagination');

  readonly pageChangeScrollAnchor = input<HTMLElement | ElementRef<HTMLElement> | null>(null);

  renderAs = input<'links' | 'buttons'>('links');

  protected pages$ = new BehaviorSubject<PaginationItem[] | null>(null);

  protected trackByPage: TrackByFunction<PaginationItem> = (index) => index;

  ngOnInit(): void {
    this._updateHead();
  }

  ngOnDestroy(): void {
    this._pageControlSubscription.unsubscribe();
  }

  protected onPageClick(page: PaginationItem) {
    if (page.disabled || page.current) {
      return;
    }

    this.pageControl?.setValue(page.page);
    this._paginationHeadService._updateHead(page.page);

    const pageChangeScrollAnchor = this.pageChangeScrollAnchor();
    if (pageChangeScrollAnchor) {
      const el = coerceElement(pageChangeScrollAnchor);
      el?.scrollIntoView();
    }
  }

  private _subscribeToPageControlChanges() {
    this._pageControlSubscription.unsubscribe();

    if (!this.pageControl) {
      return;
    }

    this._pageControlSubscription = this.pageControl?.valueChanges.subscribe(() => this._updatePages());
  }

  private _updatePages() {
    if (!this.pageControl || !this.totalPages) {
      this.pages$.next(null);
      return;
    }

    const pageValue = this.pageControl.value ?? 1;

    this.pages$.next(paginate({ currentPage: pageValue, totalPageCount: this.totalPages }));
  }

  private _updateHead() {
    if (this.pageControl?.value) {
      this._paginationHeadService._updateHead(this.pageControl.value);
    }
  }
}
