import { Component, ViewEncapsulation } from '@angular/core';
import { AVATAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-avatar-default-example',
  template: `
    <div>
      <et-avatar name="Jane Doe" />
      <et-avatar name="Jane Doe" color="brand" />
      <et-avatar src="https://i.pravatar.cc/128?img=12" name="John Smith" />
      <et-avatar src="data:image/png;base64,AAAA" name="Fallback Fred" />
      <et-avatar color="success" />

      <et-avatar-group [maxVisible]="3">
        @for (member of MEMBERS; track member.name) {
          <et-avatar [name]="member.name" [color]="member.color" />
        }
      </et-avatar-group>

      <et-avatar-group>
        @for (member of MEMBERS.slice(0, 3); track member.name) {
          <a [name]="member.name" [attr.aria-label]="member.name" href="#{{ member.name }}" et-avatar></a>
        }
      </et-avatar-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AVATAR_IMPORTS],
})
export class AvatarDefaultExampleComponent {
  protected readonly MEMBERS = [
    { name: 'Jane Doe', color: undefined },
    { name: 'John Smith', color: undefined },
    { name: 'Cara Lee', color: 'brand' },
    { name: 'Ada Byron', color: undefined },
    { name: 'Grace Hopper', color: 'success' },
  ];
}
