import { Component, ViewEncapsulation } from '@angular/core';

/**
 * Overlaps a row of `et-avatar`s into a stack, each one ringed so it reads apart from its neighbor.
 * Project the avatars you want shown, in order - including any "+N" overflow indicator, itself just
 * another `et-avatar` with initials text.
 *
 * @example
 * <et-avatar-group>
 *   <et-avatar name="Jane Doe" />
 *   <et-avatar name="John Smith" />
 *   <et-avatar>+5</et-avatar>
 * </et-avatar-group>
 */
@Component({
  selector: 'et-avatar-group',
  template: `<ng-content />`,
  styleUrl: './avatar-group.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-avatar-group',
  },
})
export class AvatarGroupComponent {}
