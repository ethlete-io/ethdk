import {
  Component,
  computed,
  contentChildren,
  effect,
  ElementRef,
  input,
  numberAttribute,
  ViewEncapsulation,
} from '@angular/core';
import { AvatarComponent, AVATAR_SHAPES, AVATAR_SIZES } from './avatar.component';

/**
 * Overlaps a row of `et-avatar`s into a stack, each one ringed so it reads apart from its neighbor.
 * Project the avatars you want shown, in order.
 *
 * Past `maxVisible` the group hides the rest and appends a `+N` avatar of its own, matching the first
 * projected avatar's size and shape. Without it every projected avatar is shown, and a "+N" you
 * project yourself is just another avatar.
 *
 * @example
 * <et-avatar-group [maxVisible]="3">
 *   @for (member of members(); track member.id) {
 *     <et-avatar [name]="member.name" [src]="member.avatarUrl" />
 *   }
 * </et-avatar-group>
 */
@Component({
  selector: 'et-avatar-group',
  template: `
    <ng-content />

    @if (overflowCount() > 0) {
      <et-avatar [size]="overflowSize()" [shape]="overflowShape()" class="et-avatar-group-overflow"
        >+{{ overflowCount() }}</et-avatar
      >
    }
  `,
  styleUrl: './avatar-group.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AvatarComponent],
  host: {
    class: 'et-avatar-group',
  },
})
export class AvatarGroupComponent {
  /**
   * How many of the projected avatars to show. The rest are hidden and counted into a trailing `+N`
   * avatar. Unset shows all of them.
   */
  public maxVisible = input(undefined, {
    transform: (value: unknown) =>
      value === undefined || value === null || value === '' ? undefined : numberAttribute(value),
  });

  private projectedAvatars = contentChildren(AvatarComponent, { descendants: true });
  private projectedElements = contentChildren(AvatarComponent, { descendants: true, read: ElementRef });

  protected overflowCount = computed(() => {
    const max = this.maxVisible();

    if (max === undefined) return 0;

    return Math.max(this.projectedAvatars().length - Math.max(max, 0), 0);
  });

  // The overflow avatar is the group's own, so it has to be told what the projected ones look like.
  protected overflowSize = computed(() => this.projectedAvatars()[0]?.size() ?? AVATAR_SIZES.MD);
  protected overflowShape = computed(() => this.projectedAvatars()[0]?.shape() ?? AVATAR_SHAPES.CIRCLE);

  constructor() {
    effect(() => {
      const max = this.maxVisible();
      const elements = this.projectedElements();

      // Hiding is a DOM write rather than a class the avatar carries: which avatars are over the limit
      // is the group's business, and an avatar projected from a `@for` cannot be bound from here.
      elements.forEach((element, index) => {
        element.nativeElement.hidden = max !== undefined && index >= Math.max(max, 0);
      });
    });
  }
}
