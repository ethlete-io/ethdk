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
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SKELETON_IMPORTS, ProvideSurfaceDirective],
})
export class SkeletonStorybookComponent {
  public animated = input(true);
  public surface = input('dark');
}
