import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulAsset } from '../../types';
import { RICH_TEXT_RENDERER_COMPONENT_DATA } from '../rich-text-renderer';

@Component({
  selector: 'et-contentful-video',
  template: `
    <video *ngIf="data" [ngClass]="videoClass" controls>
      <source src="{{ data.url }}" type="{{ data.contentType }}" />
    </video>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf, NgClass],
})
export class ContentfulVideoComponent implements OnInit {
  private _richTextData = inject<ContentfulAsset>(RICH_TEXT_RENDERER_COMPONENT_DATA, { optional: true });

  @Input()
  get data() {
    return this._data;
  }
  set data(v: ContentfulAsset | null | undefined) {
    if (v && !v.contentType) {
      this._data = null;

      console.warn('The provided asset is invalid', v);

      return;
    }

    if (v && !v.contentType.startsWith('video/')) {
      throw new Error('The provided asset is not an video');
    }

    this._data = v ?? null;
  }
  private _data: ContentfulAsset | null = null;

  @Input()
  videoClass: NgClassType = null;

  ngOnInit(): void {
    if (this._richTextData && !this.data) {
      this.data = this._richTextData;
    }
  }
}
