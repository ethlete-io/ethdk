import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { StreamPlayerLoadingComponent } from './stream-player-loading.component';

describe('StreamPlayerLoadingComponent', () => {
  let fixture: ComponentFixture<StreamPlayerLoadingComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [StreamPlayerLoadingComponent],
    });
    fixture = TestBed.createComponent(StreamPlayerLoadingComponent);
    host = fixture.nativeElement;
  });

  it('renders spinner component', () => {
    fixture.detectChanges();
    const spinner = host.querySelector('et-spinner');
    expect(spinner).not.toBeNull();
  });

  it('ships its styles inside the components cascade layer', () => {
    fixture.detectChanges();
    const css = Array.from(document.head.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .find((text) => text.includes('.et-stream-player-loading'));

    expect(css?.trim().startsWith('@layer components')).toBe(true);
    expect(css).toContain('position: absolute');
  });
});
