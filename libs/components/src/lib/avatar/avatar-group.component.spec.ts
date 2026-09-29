import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideAvatarLabels } from './avatar-labels';
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

@Component({
  selector: 'et-test-avatar-group-overflow-host',
  template: `
    <et-avatar-group [maxVisible]="1">
      <et-avatar name="Jane Doe" />
      <et-avatar name="John Smith" />
      <et-avatar name="Max Muster" />
    </et-avatar-group>
  `,
  imports: [AVATAR_IMPORTS],
})
class AvatarGroupOverflowHostComponent {}

describe('AvatarGroupComponent', () => {
  it('renders the projected avatars', () => {
    const fixture = TestBed.createComponent(AvatarGroupHostComponent);
    fixture.detectChanges();

    const avatars = fixture.nativeElement.querySelectorAll('et-avatar-group et-avatar');

    expect(avatars.length).toBe(3);
    expect(avatars[2].textContent?.trim()).toBe('+5');
  });

  it('names the +N overflow avatar for assistive tech', () => {
    const fixture = TestBed.createComponent(AvatarGroupOverflowHostComponent);
    fixture.detectChanges();

    const overflow = fixture.nativeElement.querySelector('.et-avatar-group-overflow');

    expect(overflow.textContent.trim()).toBe('+2');
    expect(overflow.getAttribute('role')).toBe('img');
    expect(overflow.getAttribute('aria-label')).toBe('2 more');
  });

  it('localizes the overflow name', () => {
    TestBed.configureTestingModule({ providers: [provideAvatarLabels({ more: (count) => `${count} weitere` })] });

    const fixture = TestBed.createComponent(AvatarGroupOverflowHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.et-avatar-group-overflow').getAttribute('aria-label')).toBe(
      '2 weitere',
    );
  });
});
