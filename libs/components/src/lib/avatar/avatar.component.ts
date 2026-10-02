import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';

export const AVATAR_SIZES = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
} as const;

export type AvatarSize = (typeof AVATAR_SIZES)[keyof typeof AVATAR_SIZES];

export const AVATAR_SHAPES = {
  CIRCLE: 'circle',
  SQUARE: 'square',
} as const;

export type AvatarShape = (typeof AVATAR_SHAPES)[keyof typeof AVATAR_SHAPES];

const initialsFromName = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
};

/**
 * A user/entity representation: an image, falling back to initials (`initials`, else derived from
 * `name`), falling back to projected content (e.g. an icon) when neither is set. A failed image load
 * falls back the same way.
 *
 * Also an attribute selector, so an avatar that has to be a link or a button is written as one -
 * `routerLink`, `href` and click handlers stay on the consumer's own element.
 *
 * @example
 * <et-avatar src="/jane.jpg" name="Jane Doe" />
 * <et-avatar name="Jane Doe" color="brand" />
 * <et-avatar name="Dr. Anna Maria Schmidt" initials="AS" />
 * <et-avatar><i etIcon="user" label="Guest"></i></et-avatar>
 * <a [routerLink]="['/users', user.id]" [name]="user.name" et-avatar></a>
 */
@Component({
  selector: 'et-avatar, [et-avatar]',
  template: `
    @if (imageVisible()) {
      <img [src]="src()" [alt]="name() ?? ''" (error)="markImageFailed()" class="et-avatar-image" />
    } @else if (displayedInitials()) {
      <span [attr.role]="name() ? 'img' : null" [attr.aria-label]="name() || null" class="et-avatar-initials">{{
        displayedInitials()
      }}</span>
    } @else {
      <ng-content />
    }
  `,
  styleUrl: './avatar.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-avatar',
    '[attr.data-size]': 'size()',
    '[attr.data-shape]': 'shape()',
  },
})
export class AvatarComponent {
  public src = input<string | null>(null);
  public name = input<string | null>(null);

  /** Rendered verbatim in place of the initials derived from `name`, e.g. `"AS"` or a team short code. */
  public initials = input<string | null>(null);
  public size = input<AvatarSize>(AVATAR_SIZES.MD);
  public shape = input<AvatarShape>(AVATAR_SHAPES.CIRCLE);

  protected displayedInitials = computed(() => {
    const explicit = this.initials();

    if (explicit) return explicit;

    const name = this.name();

    return name ? initialsFromName(name) : null;
  });

  private imageFailed = linkedSignal<string | null, boolean>({
    source: () => this.src(),
    computation: () => false,
  });

  protected imageVisible = computed(() => !!this.src() && !this.imageFailed());

  protected markImageFailed() {
    this.imageFailed.set(true);
  }
}
