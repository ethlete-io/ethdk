import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { OVERLAY_DATA } from './overlay-data';
import { OverlayTemplateHostComponent } from './overlay-template-host.component';

describe('OverlayTemplateHostComponent', () => {
  let fixture: ComponentFixture<OverlayTemplateHostComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverlayTemplateHostComponent],
      providers: [{ provide: OVERLAY_DATA, useValue: { context: {}, template: null } }],
    });
    fixture = TestBed.createComponent(OverlayTemplateHostComponent);
    host = fixture.nativeElement;
  });

  it('renders component', () => {
    fixture.detectChanges();
    expect(host).toBeDefined();
  });

  it('has et-overlay-template-host class', () => {
    fixture.detectChanges();
    expect(host.classList.contains('et-overlay-template-host')).toBe(true);
  });

  it('renders without error', () => {
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
