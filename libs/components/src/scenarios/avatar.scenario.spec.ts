import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AVATAR_IMPORTS, AVATAR_SHAPES, AVATAR_SIZES, AvatarShape, AvatarSize } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

type Member = { id: number; name: string; avatarUrl: string | null };

const MEMBERS: Member[] = [
  { id: 1, name: 'Jane Doe', avatarUrl: '/jane.jpg' },
  { id: 2, name: 'max', avatarUrl: null },
  { id: 3, name: '  Ada   King Lovelace ', avatarUrl: null },
  { id: 4, name: 'Team A', avatarUrl: null },
  { id: 5, name: 'Team B', avatarUrl: null },
];

@Component({
  selector: 'et-scenario-profile',
  imports: [AVATAR_IMPORTS],
  template: `
    <et-avatar [src]="src()" [name]="name()" [size]="size()" [shape]="shape()" class="profile">
      <span class="fallback-icon">?</span>
    </et-avatar>
    <a [name]="name()" class="profile-link" aria-label="Profile" href="/users/1" et-avatar></a>
  `,
})
class ProfileComponent {
  src = signal<string | null>('/jane.jpg');
  name = signal<string | null>('Jane Doe');
  size = signal<AvatarSize>(AVATAR_SIZES.XL);
  shape = signal<AvatarShape>(AVATAR_SHAPES.SQUARE);
}

@Component({
  selector: 'et-scenario-members',
  imports: [AVATAR_IMPORTS],
  template: `
    <et-avatar-group [maxVisible]="maxVisible()">
      @for (member of members(); track member.id) {
        <et-avatar [name]="member.name" [src]="member.avatarUrl" [size]="size" [shape]="shape" />
      }
    </et-avatar-group>
  `,
})
class MembersComponent {
  members = signal(MEMBERS);
  maxVisible = signal<number | undefined>(3);
  size = AVATAR_SIZES.SM;
  shape = AVATAR_SHAPES.SQUARE;
}

const shown = (host: Element) =>
  Array.from(host.querySelectorAll<HTMLElement>('et-avatar-group > et-avatar:not(.et-avatar-group-overflow)'))
    .filter((avatar) => !avatar.hidden)
    .map((avatar) => avatar.textContent?.trim() || avatar.querySelector('img')?.getAttribute('alt'));

describe('avatar scenarios', () => {
  const scenario = useScenario();

  it('falls back from the image to initials to projected content', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileComponent);
    const page = fixture.componentInstance;
    const profile = (fixture.nativeElement as HTMLElement).querySelector('.profile')!;

    s.tick();

    expect(profile.getAttribute('data-size')).toBe('xl');
    expect(profile.getAttribute('data-shape')).toBe('square');

    const image = profile.querySelector('img')!;

    expect(image.getAttribute('src')).toBe('/jane.jpg');
    expect(image.getAttribute('alt')).toBe('Jane Doe');

    image.dispatchEvent(new Event('error'));
    s.tick();

    expect(profile.querySelector('img')).toBeNull();
    expect(profile.querySelector('.et-avatar-initials')?.textContent).toBe('JD');

    page.src.set('/jane-new.jpg');
    s.tick();

    expect(profile.querySelector('img')?.getAttribute('src')).toBe('/jane-new.jpg');

    page.src.set(null);
    page.name.set('  ada king  lovelace ');
    s.tick();

    expect(profile.querySelector('.et-avatar-initials')?.textContent).toBe('AL');

    page.name.set(null);
    s.tick();

    expect(profile.querySelector('.et-avatar-initials')).toBeNull();
    expect(profile.querySelector('.fallback-icon')?.textContent).toBe('?');
  });

  it('keeps a link avatar a real link', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ProfileComponent);
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.profile-link')!;

    s.tick();

    expect(link.classList).toContain('et-avatar');
    expect(link.getAttribute('href')).toBe('/users/1');
    expect(link.getAttribute('data-size')).toBe('md');
    expect(link.getAttribute('data-shape')).toBe('circle');
    expect(link.textContent?.trim()).toBe('JD');
  });

  it('stacks members past maxVisible into a +N avatar shaped like the first one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(MembersComponent);
    const page = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const overflow = () => host.querySelector('.et-avatar-group-overflow');

    s.tick();

    expect(shown(host)).toEqual(['Jane Doe', 'M', 'AL']);
    expect(overflow()?.textContent?.trim()).toBe('+2');
    expect(overflow()?.getAttribute('data-size')).toBe('sm');
    expect(overflow()?.getAttribute('data-shape')).toBe('square');

    page.members.set(MEMBERS.slice(1));
    s.tick();

    expect(shown(host)).toEqual(['M', 'AL', 'TA']);
    expect(overflow()?.textContent?.trim()).toBe('+1');

    page.maxVisible.set(0);
    s.tick();

    expect(shown(host)).toEqual([]);
    expect(overflow()?.textContent?.trim()).toBe('+4');

    page.maxVisible.set(undefined);
    s.tick();

    expect(shown(host)).toEqual(['M', 'AL', 'TA', 'TB']);
    expect(overflow()).toBeNull();
    expect(s.errors).toEqual([]);
  });
});
