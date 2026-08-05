import { Component, ViewEncapsulation, input } from '@angular/core';
import { AvatarShape, AvatarSize } from '../avatar.component';
import { AVATAR_IMPORTS } from '../avatar.imports';

@Component({
  selector: 'et-sb-avatar',
  template: `
    <div class="flex flex-wrap items-center gap-2 p-8 font-sans">
      <et-avatar [size]="size()" [shape]="shape()" name="Jane Doe" />
      <et-avatar [size]="size()" [shape]="shape()" name="Jane Doe" color="brand" />
      <et-avatar [size]="size()" [shape]="shape()" src="https://i.pravatar.cc/128?img=12" name="John Smith" />
      <et-avatar [size]="size()" [shape]="shape()" src="/broken-image.jpg" name="Fallback Fred" />
      <et-avatar [size]="size()" [shape]="shape()" color="success" />

      <et-avatar-group>
        <et-avatar [size]="size()" [shape]="shape()" name="Jane Doe" />
        <et-avatar [size]="size()" [shape]="shape()" name="John Smith" />
        <et-avatar [size]="size()" [shape]="shape()" name="Cara Lee" color="brand" />
        <et-avatar [size]="size()" [shape]="shape()">+5</et-avatar>
      </et-avatar-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AVATAR_IMPORTS],
})
export class AvatarStorybookComponent {
  public size = input<AvatarSize>('md');
  public shape = input<AvatarShape>('circle');
}
