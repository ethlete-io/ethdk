import { Component, ViewEncapsulation } from '@angular/core';
import { AVATAR_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-avatar-custom-initials-and-colors-example',
  template: `
    <div>
      <et-avatar name="Dr. Anna Maria Schmidt" />
      <et-avatar name="Dr. Anna Maria Schmidt" initials="AS" />
      <et-avatar initials="FCB" color="brand" />
      <et-avatar initials="BVB" color="warning" />
    </div>

    <div>
      <et-avatar class="tonal-avatar" name="Grace Hopper" color="success" />
      <et-avatar class="tonal-avatar" name="Ada Byron" color="danger" />
      <et-avatar class="inverted-avatar" name="Jane Doe" />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AVATAR_IMPORTS],
  styles: `
    .tonal-avatar {
      --et-avatar-background: color-mix(in srgb, var(--et-theme-color-primary-solid) 16%, transparent);
      --et-avatar-color: var(--et-theme-color-ink-solid);
    }

    .inverted-avatar {
      --et-avatar-background: var(--et-surface-color-solid);
      --et-avatar-color: var(--et-surface-background-solid);
    }
  `,
})
export class AvatarCustomInitialsAndColorsExampleComponent {}
