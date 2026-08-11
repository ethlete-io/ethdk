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

      <!-- The group counts what is over the limit and appends the +N itself. -->
      <et-avatar-group [maxVisible]="maxVisible()">
        @for (member of MEMBERS; track member.name) {
          <et-avatar [size]="size()" [shape]="shape()" [name]="member.name" [color]="member.color" />
        }
      </et-avatar-group>

      <!-- An avatar that navigates is written as the link it is. -->
      <et-avatar-group>
        @for (member of MEMBERS.slice(0, 3); track member.name) {
          <a
            [size]="size()"
            [shape]="shape()"
            [name]="member.name"
            [attr.aria-label]="member.name"
            href="#{{ member.name }}"
            et-avatar
          ></a>
        }
      </et-avatar-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AVATAR_IMPORTS],
})
export class AvatarStorybookComponent {
  public size = input<AvatarSize>('md');
  public shape = input<AvatarShape>('circle');
  public maxVisible = input<number | undefined>(3);

  protected readonly MEMBERS = [
    { name: 'Jane Doe', color: undefined },
    { name: 'John Smith', color: undefined },
    { name: 'Cara Lee', color: 'brand' },
    { name: 'Ada Byron', color: undefined },
    { name: 'Grace Hopper', color: 'success' },
  ];
}
