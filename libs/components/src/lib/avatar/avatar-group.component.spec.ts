import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { AVATAR_IMPORTS } from './avatar.imports';

@Component({
  selector: 'et-test-avatar-group-host',
  template: `
    <et-avatar-group>
      <et-avatar name="Jane Doe" />
      <et-avatar name="John Smith" />
      <et-avatar>+5</et-avatar>
    </et-avatar-group>
  `,
  imports: [AVATAR_IMPORTS],
})
class AvatarGroupHostComponent {}

describe('AvatarGroupComponent', () => {
  it('renders the projected avatars', () => {
    const fixture = TestBed.createComponent(AvatarGroupHostComponent);
    fixture.detectChanges();

    const avatars = fixture.nativeElement.querySelectorAll('et-avatar-group et-avatar');

    expect(avatars.length).toBe(3);
    expect(avatars[2].textContent?.trim()).toBe('+5');
  });
});
