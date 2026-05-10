import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

const BRAND_E_PATH =
  'M15.905 6.21401C15.7794 6.8902 16.2818 7.51877 16.9517 7.51877H23.8598L22.9201 12.3378H15.6817C15.1048 12.3378 14.6071 12.7569 14.5001 13.3378C14.4861 13.4188 14.4768 13.4997 14.4768 13.5811C14.4768 14.2426 15.0071 14.8092 15.6817 14.8092H23.9435L22.9201 19.9997H6.79183L7.2198 17.814H7.64313C7.94085 17.814 8.20601 17.6907 8.40139 17.495C8.59212 17.2954 8.71307 17.0235 8.71307 16.7235C8.71307 16.1188 8.23858 15.6331 7.64778 15.6288H2.73534C2.14919 15.6288 1.67004 15.1426 1.67004 14.5378C1.67004 14.2383 1.791 13.9621 1.98172 13.7664C2.17711 13.5711 2.44227 13.4473 2.73534 13.4473H8.07111L8.96428 8.88115H9.39226C9.68533 8.88115 9.95049 8.75686 10.1459 8.5621C10.3366 8.3621 10.4576 8.08591 10.4576 7.78543C10.4576 7.18543 9.9784 6.69543 9.39226 6.69543H4.48447C3.89367 6.69543 3.41452 6.20448 3.41452 5.60496C3.41452 5.30448 3.53547 5.02877 3.7262 4.82829C3.92158 4.63353 4.19139 4.50924 4.48447 4.50924H10.2436C10.5366 4.50924 10.8064 4.3902 10.9972 4.1902C11.1879 3.99496 11.3089 3.72401 11.3089 3.41877C11.3089 2.81401 10.8344 2.32829 10.2436 2.32829H1.06994C0.479149 2.32829 0 1.83829 0 1.23305C0 0.933054 0.12095 0.656864 0.31168 0.461626C0.507061 0.266864 0.776873 0.142578 1.06994 0.142578H26.4369L25.4135 5.33305H16.9517C16.4446 5.33305 16.0027 5.70496 15.905 6.21401Z';

const BRAND_E_OUTLINE_PATH =
  'M1.07 0.14 L26.44 0.14 L25.41 5.33 L16.95 5.33 C16.44 5.33 16.0 5.70 15.91 6.21 C15.78 6.89 16.28 7.52 16.95 7.52 L23.86 7.52 L22.92 12.34 L15.68 12.34 C15.10 12.34 14.61 12.76 14.50 13.34 C14.49 13.42 14.48 13.50 14.48 13.58 C14.48 14.24 15.01 14.81 15.68 14.81 L23.94 14.81 L22.92 20.0 L6.79 20.0 L7.22 17.81 L7.64 17.81 C7.94 17.81 8.21 17.69 8.40 17.50 C8.59 17.30 8.71 17.02 8.71 16.72 C8.71 16.12 8.24 15.63 7.65 15.63 L2.74 15.63 C2.15 15.63 1.67 15.14 1.67 14.54 C1.67 14.24 1.79 13.96 1.98 13.77 C2.18 13.57 2.44 13.45 2.74 13.45 L8.07 13.45 L8.96 8.88 L9.39 8.88 C9.69 8.88 9.95 8.76 10.15 8.56 C10.34 8.36 10.46 8.09 10.46 7.79 C10.46 7.19 9.98 6.70 9.39 6.70 L4.48 6.70 C3.89 6.70 3.41 6.20 3.41 5.60 C3.41 5.30 3.54 5.03 3.73 4.83 C3.92 4.63 4.19 4.51 4.48 4.51 L10.24 4.51 C10.54 4.51 10.81 4.39 10.997 4.19 C11.188 3.99 11.31 3.72 11.31 3.42 C11.31 2.81 10.83 2.33 10.24 2.33 L1.07 2.33 C0.48 2.33 0 1.84 0 1.23 C0 0.93 0.12 0.66 0.31 0.46 C0.51 0.27 0.78 0.14 1.07 0.14 Z';

let nextId = 0;

@Component({
  selector: 'et-brand-loader',
  template: `
    <svg class="et-brand-loader__svg" viewBox="0 0 26.4369 20" aria-hidden="true">
      <defs>
        <clipPath [attr.id]="shapeClipId" clipPathUnits="userSpaceOnUse">
          <path [attr.d]="path" />
        </clipPath>

        <clipPath [attr.id]="fillClipId" clipPathUnits="userSpaceOnUse">
          <rect class="et-brand-loader__fill-clip-rect" x="0" y="0" width="0" height="20" />
        </clipPath>
      </defs>

      <path [attr.d]="path" class="et-brand-loader__ghost" />

      <path [attr.d]="outlinePath" [attr.clip-path]="shapeClip" class="et-brand-loader__outline" pathLength="100" />

      <path [attr.d]="path" [attr.clip-path]="fillClip" class="et-brand-loader__fill" />
    </svg>
  `,
  styleUrl: './brand-loader.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-brand-loader',
    role: 'progressbar',
    'aria-label': 'Loading',
  },
})
export class BrandLoaderComponent {
  path = BRAND_E_PATH;
  outlinePath = BRAND_E_OUTLINE_PATH;

  shapeClipId = `et-brand-loader-shape-${nextId}`;
  shapeClip = `url(#${this.shapeClipId})`;

  fillClipId = `et-brand-loader-fill-${nextId}`;
  fillClip = `url(#${this.fillClipId})`;

  constructor() {
    nextId++;
  }
}
