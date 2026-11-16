import { Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { SKELETON_IMPORTS } from '../skeleton.imports';

@Component({
  selector: 'et-sb-skeleton',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <!-- A card: avatar plus lines, the shape most loading states need. -->
      <et-skeleton [animated]="animated()" [style.max-inline-size.px]="420">
        <div class="flex items-center gap-3">
          <et-skeleton-item style="--et-skeleton-size: 40px" shape="circle" />
          <et-skeleton-text [lines]="2" />
        </div>
        <et-skeleton-item style="block-size: 140px; --et-skeleton-radius: 12px" shape="rect" />
      </et-skeleton>

      <!-- Bones read as text because shape="text" is sized in em: dropped into copy they take exactly
           the line height of the words they stand in for. -->
      <p [style.max-inline-size.px]="420" class="text-medium">
        Real text, then <et-skeleton-item [style.max-inline-size.px]="120" shape="text" /> in the middle of it.
      </p>

      @if (layouts()) {
        <div class="flex items-center" data-layout="centered-row" style="block-size: 64px; inline-size: 320px">
          <et-skeleton-item style="inline-size: 48px" shape="rect" />
        </div>
        <div class="grid items-center" data-layout="centered-grid" style="block-size: 64px; inline-size: 320px">
          <et-skeleton-item style="inline-size: 48px" shape="rect" />
        </div>
        <div data-layout="margin" style="inline-size: 320px">
          <et-skeleton-item style="margin-inline: 16px" shape="rect" />
        </div>
        <div class="flex" data-layout="ratio-column" style="flex-direction: column; inline-size: 320px">
          <et-skeleton-item style="aspect-ratio: 4" shape="rect" />
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SKELETON_IMPORTS, ProvideSurfaceDirective],
})
export class SkeletonStorybookComponent {
  public animated = input(true);
  public layouts = input(false);
  public surface = input('dark');
}
