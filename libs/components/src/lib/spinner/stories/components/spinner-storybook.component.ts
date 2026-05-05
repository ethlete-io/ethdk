import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { SpinnerComponent } from '../../spinner.component';

const BRAND_E_PATH =
  'M15.905 6.21401C15.7794 6.8902 16.2818 7.51877 16.9517 7.51877H23.8598L22.9201 12.3378H15.6817C15.1048 12.3378 14.6071 12.7569 14.5001 13.3378C14.4861 13.4188 14.4768 13.4997 14.4768 13.5811C14.4768 14.2426 15.0071 14.8092 15.6817 14.8092H23.9435L22.9201 19.9997H6.79183L7.2198 17.814H7.64313C7.94085 17.814 8.20601 17.6907 8.40139 17.495C8.59212 17.2954 8.71307 17.0235 8.71307 16.7235C8.71307 16.1188 8.23858 15.6331 7.64778 15.6288H2.73534C2.14919 15.6288 1.67004 15.1426 1.67004 14.5378C1.67004 14.2383 1.791 13.9621 1.98172 13.7664C2.17711 13.5711 2.44227 13.4473 2.73534 13.4473H8.07111L8.96428 8.88115H9.39226C9.68533 8.88115 9.95049 8.75686 10.1459 8.5621C10.3366 8.3621 10.4576 8.08591 10.4576 7.78543C10.4576 7.18543 9.9784 6.69543 9.39226 6.69543H4.48447C3.89367 6.69543 3.41452 6.20448 3.41452 5.60496C3.41452 5.30448 3.53547 5.02877 3.7262 4.82829C3.92158 4.63353 4.19139 4.50924 4.48447 4.50924H10.2436C10.5366 4.50924 10.8064 4.3902 10.9972 4.1902C11.1879 3.99496 11.3089 3.72401 11.3089 3.41877C11.3089 2.81401 10.8344 2.32829 10.2436 2.32829H1.06994C0.479149 2.32829 0 1.83829 0 1.23305C0 0.933054 0.12095 0.656864 0.31168 0.461626C0.507061 0.266864 0.776873 0.142578 1.06994 0.142578H26.4369L25.4135 5.33305H16.9517C16.4446 5.33305 16.0027 5.70496 15.905 6.21401Z';

const BRAND_E_OUTLINE_PATH =
  'M3.15 1.95H22.95 M9.85 3.95L7.05 18.05 M7.05 18.05H21.15 M15.95 6.45H21.85 M15.15 10.55H20.95 M8.75 6.75H3.2 M7.95 10.85H3.05 M7.2 14.95H3.05';

@Component({
  selector: 'et-sb-spinner',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      @if (brandLoader()) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">brand loader concept</p>
          <div class="flex min-h-36 items-center justify-center rounded-2xl border border-slate-900/10 bg-white p-6">
            <div class="et-sb-brand-loader" aria-label="Loading">
              <svg class="et-sb-brand-loader__svg" viewBox="0 0 26.4369 20" aria-hidden="true">
                <defs>
                  <clipPath [attr.id]="brandFillClipId" clipPathUnits="userSpaceOnUse">
                    <rect class="et-sb-brand-loader__fill-clip-rect" x="0" y="0" width="0" height="20" />
                  </clipPath>
                </defs>

                <path [attr.d]="brandPath" class="et-sb-brand-loader__base-shape" />
                <path [attr.d]="brandOutlinePath" class="et-sb-brand-loader__outline-shape" pathLength="100" />
                <path [attr.d]="brandPath" [attr.clip-path]="brandFillClip" class="et-sb-brand-loader__active-shape" />
              </svg>
            </div>
          </div>
        </div>
      } @else {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">spinner</p>
          <div class="flex min-h-36 items-center justify-center rounded-2xl border border-slate-900/10 bg-white p-6">
            <et-spinner [diameter]="diameter()" [strokeWidth]="strokeWidth()" [track]="track()" />
          </div>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  styles: `
    @keyframes et-sb-brand-loader-outline-draw {
      0% {
        stroke-dashoffset: 100;
      }

      100% {
        stroke-dashoffset: 0;
      }
    }

    @keyframes et-sb-brand-loader-fill-reveal {
      0%,
      45% {
        width: 0;
      }

      100% {
        width: 26.4369px;
      }
    }

    .et-sb-brand-loader {
      position: relative;
      width: 10rem;
      aspect-ratio: 26.4369 / 20;
      color: #00ffa1;
    }

    .et-sb-brand-loader__svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .et-sb-brand-loader__base-shape,
    .et-sb-brand-loader__outline-shape,
    .et-sb-brand-loader__active-shape {
      fill: currentColor;
    }

    .et-sb-brand-loader__base-shape {
      color: color-mix(in srgb, #00ffa1 16%, white);
    }

    .et-sb-brand-loader__active-shape {
      color: #00ffa1;
      filter: drop-shadow(0 0 10px rgba(0, 255, 161, 0.16));
    }

    .et-sb-brand-loader__outline-shape {
      fill: none;
      stroke: #00ffa1;
      stroke-width: 1.15;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      filter: drop-shadow(0 0 5px rgba(0, 255, 161, 0.1));
      animation: et-sb-brand-loader-outline-draw 1650ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }

    .et-sb-brand-loader__fill-clip-rect {
      animation: et-sb-brand-loader-fill-reveal 1650ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
  `,
})
export class SpinnerStorybookComponent {
  brandPath = BRAND_E_PATH;
  brandOutlinePath = BRAND_E_OUTLINE_PATH;
  brandFillClipId = 'et-sb-brand-loader-fill-clip';
  brandFillClip = `url(#${this.brandFillClipId})`;

  brandLoader = input(false);
  diameter = input(32);
  strokeWidth = input(3.25);
  track = input(true);
}
