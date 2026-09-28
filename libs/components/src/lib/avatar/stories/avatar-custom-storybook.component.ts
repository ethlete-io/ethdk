import { Component, ViewEncapsulation, input } from '@angular/core';
import { AvatarShape, AvatarSize } from '../avatar.component';
import { AVATAR_IMPORTS } from '../avatar.imports';

@Component({
  selector: 'et-sb-avatar-custom',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans">
      <div class="flex flex-wrap items-center gap-2">
        <et-avatar [size]="size()" [shape]="shape()" name="Dr. Anna Maria Schmidt" />
        <et-avatar [size]="size()" [shape]="shape()" name="Dr. Anna Maria Schmidt" initials="AS" />
        <et-avatar [size]="size()" [shape]="shape()" initials="FCB" color="brand" />
        <et-avatar [size]="size()" [shape]="shape()" initials="BVB" color="warning" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <et-avatar [size]="size()" [shape]="shape()" class="et-sb-avatar-tonal" name="Grace Hopper" color="success" />
        <et-avatar [size]="size()" [shape]="shape()" class="et-sb-avatar-tonal" name="Ada Byron" color="danger" />
        <et-avatar [size]="size()" [shape]="shape()" class="et-sb-avatar-inverted" name="Jane Doe" />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AVATAR_IMPORTS],
  styles: `
    .et-sb-avatar-tonal {
      --et-avatar-background: color-mix(in srgb, var(--et-theme-color-primary-solid) 16%, transparent);
      --et-avatar-color: var(--et-theme-color-ink-solid);
    }

    .et-sb-avatar-inverted {
      --et-avatar-background: var(--et-surface-color-solid);
      --et-avatar-color: var(--et-surface-background-solid);
    }
  `,
})
export class AvatarCustomStorybookComponent {
  public size = input<AvatarSize>('md');
  public shape = input<AvatarShape>('circle');
}
