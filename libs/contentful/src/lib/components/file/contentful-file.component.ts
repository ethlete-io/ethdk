import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { NgClassType } from '@ethlete/core';
import { ContentfulAsset } from '../../types';
import { RICH_TEXT_RENDERER_COMPONENT_DATA } from '../rich-text-renderer';

@Component({
  selector: 'et-contentful-file',
  template: `
    <a *ngIf="data" [href]="data.url" [ngClass]="fileClass" class="underline" target="_blank">
      {{ data.title }} ({{ data.size }} Bytes)
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [NgIf, NgClass],
})
export class ContentfulFileComponent implements OnInit {
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

    this._data = v ?? null;
  }
  private _data: ContentfulAsset | null = null;

  @Input()
  fileClass: NgClassType = null;

  ngOnInit(): void {
    if (this._richTextData) {
      this.data = this._richTextData;
    }
  }
}
