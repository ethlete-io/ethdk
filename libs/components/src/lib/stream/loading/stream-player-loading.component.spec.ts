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

  it('renders without error', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('has et-stream-player-loading class', () => {
    fixture.detectChanges();
    expect(host.classList.contains('et-stream-player-loading')).toBe(true);
  });

  it('renders spinner component', () => {
    fixture.detectChanges();
    const spinner = host.querySelector('et-spinner');
    expect(spinner).not.toBeNull();
  });

  it('applies position absolute styles', () => {
    fixture.detectChanges();
    const style = window.getComputedStyle(host);
    expect(style.position).toBe('absolute');
  });
});
