import { BooleanInput, coerceBooleanProperty, coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import { AsyncPipe, NgForOf, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnDestroy,
  OnInit,
  TrackByFunction,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { BehaviorSubject, Subscription } from 'rxjs';
import { PaginationLinkDirective } from '../../partials';
import { PaginationHeadService } from '../../services';
import { PaginationItem } from '../../types';
import { paginate } from '../../utils';

@Component({
  selector: 'et-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgForOf, AsyncPipe, NgIf, PaginationLinkDirective],
  providers: [PaginationHeadService],
  host: {
    class: 'et-pagination',
  },
})
export class PaginationComponent implements OnInit, OnDestroy {
  private _pageControlSubscription = Subscription.EMPTY;
  private _paginationHeadService = inject(PaginationHeadService);

  @Input()
  get pageControl() {
    return this._pageControl;
  }
  set pageControl(v: FormControl<number | null> | null) {
    this._pageControl = v;
    this._updatePages();
    this._subscribeToPageControlChanges();
  }
  private _pageControl: FormControl<number | null> | null = null;

  @Input()
  get totalPages(): number {
    return this._totalPages;
  }
  set totalPages(value: NumberInput) {
    this._totalPages = coerceNumberProperty(value);
    this._updatePages();
  }
  private _totalPages = 0;

  @Input()
  set headTitleTemplate(v: string | null) {
    this._paginationHeadService.titleTemplate = v;
    this._updateHead();
  }

  @Input()
  set headFirstPageTitle(v: string | null) {
    this._paginationHeadService.firstPageTitle = v;
    this._updateHead();
  }

  @Input()
  set headAddCanonicalTag(v: BooleanInput) {
    this._paginationHeadService.addCanonicalTag = coerceBooleanProperty(v);
    this._updateHead();
  }

  @Input()
  ariaLabel = 'Pagination';

  @Input()
  pageChangeScrollAnchor: HTMLElement | null = null;

  protected pages$ = new BehaviorSubject<PaginationItem[] | null>(null);

  protected trackByPage: TrackByFunction<PaginationItem> = (_, item) => item.page;

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

    if (this.pageChangeScrollAnchor) {
      this.pageChangeScrollAnchor.scrollIntoView();
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
    if (!this.pageControl?.value || !this.totalPages) {
      this.pages$.next(null);
      return;
    }

    this.pages$.next(paginate({ currentPage: this.pageControl.value, totalPageCount: this.totalPages }));
  }

  private _updateHead() {
    if (this.pageControl?.value) {
      this._paginationHeadService._updateHead(this.pageControl.value);
    }
  }
}
