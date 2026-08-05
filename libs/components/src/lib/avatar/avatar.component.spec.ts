import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProvideColorDirective } from '@ethlete/core';
import '../../test-helpers';
import { AvatarShape, AvatarSize } from './avatar.component';
import { AVATAR_IMPORTS } from './avatar.imports';

@Component({
  selector: 'et-test-avatar-host',
  template: `<et-avatar>JD</et-avatar>`,
  imports: [AVATAR_IMPORTS],
})
class AvatarDefaultHostComponent {}

@Component({
  selector: 'et-test-avatar-configured-host',
  template: `
    <et-avatar [src]="src()" [name]="name()" [size]="size()" [shape]="shape()" [color]="color()"></et-avatar>
  `,
  imports: [AVATAR_IMPORTS],
})
class AvatarConfiguredHostComponent {
  public src = signal<string | null>(null);
  public name = signal<string | null>(null);
  public size = signal<AvatarSize>('md');
  public shape = signal<AvatarShape>('circle');
  public color = signal<string | null>(null);
}

describe('AvatarComponent', () => {
  it('projects fallback content when there is no src or name', () => {
    const fixture = TestBed.createComponent(AvatarDefaultHostComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('JD');
  });

  it('defaults to the md size and circle shape', () => {
    const fixture = TestBed.createComponent(AvatarDefaultHostComponent);
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('et-avatar') as HTMLElement;

    expect(avatar.getAttribute('data-size')).toBe('md');
    expect(avatar.getAttribute('data-shape')).toBe('circle');
  });

  it('renders initials derived from name when there is no src', () => {
    const fixture = TestBed.createComponent(AvatarConfiguredHostComponent);
    fixture.componentInstance.name.set('Jane Doe');
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('et-avatar') as HTMLElement;

    expect(avatar.textContent?.trim()).toBe('JD');
    expect(avatar.querySelector('img')).toBeNull();
  });

  it('renders an img when src is set', () => {
    const fixture = TestBed.createComponent(AvatarConfiguredHostComponent);
    fixture.componentInstance.src.set('/jane.jpg');
    fixture.componentInstance.name.set('Jane Doe');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('et-avatar img') as HTMLImageElement;

    expect(img).not.toBeNull();
    expect(img.src).toContain('/jane.jpg');
    expect(img.alt).toBe('Jane Doe');
  });

  it('falls back to initials when the image fails to load', () => {
    const fixture = TestBed.createComponent(AvatarConfiguredHostComponent);
    fixture.componentInstance.src.set('/broken.jpg');
    fixture.componentInstance.name.set('Jane Doe');
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('et-avatar img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('et-avatar') as HTMLElement;

    expect(avatar.querySelector('img')).toBeNull();
    expect(avatar.textContent?.trim()).toBe('JD');
  });

  it('resets the failed image state when src changes', () => {
    const fixture = TestBed.createComponent(AvatarConfiguredHostComponent);
    fixture.componentInstance.src.set('/broken.jpg');
    fixture.componentInstance.name.set('Jane Doe');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('et-avatar img').dispatchEvent(new Event('error'));
    fixture.detectChanges();

    fixture.componentInstance.src.set('/jane.jpg');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('et-avatar img')).not.toBeNull();
  });

  it('reflects the size and shape inputs', () => {
    const fixture = TestBed.createComponent(AvatarConfiguredHostComponent);
    fixture.componentInstance.size.set('lg');
    fixture.componentInstance.shape.set('square');
    fixture.detectChanges();

    const avatar = fixture.nativeElement.querySelector('et-avatar') as HTMLElement;

    expect(avatar.getAttribute('data-size')).toBe('lg');
    expect(avatar.getAttribute('data-shape')).toBe('square');
  });

  it('forwards color to the color provider', () => {
    const fixture = TestBed.createComponent(AvatarConfiguredHostComponent);
    fixture.componentInstance.color.set('brand');
    fixture.detectChanges();

    const avatarDe = fixture.debugElement.query(By.css('et-avatar'));
    const provider = avatarDe.injector.get(ProvideColorDirective);

    expect(provider.color()).toBe('brand');
  });
});
