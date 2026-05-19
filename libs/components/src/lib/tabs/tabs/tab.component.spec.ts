import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { TabComponent } from './tab.component';

describe('TabComponent', () => {
  let fixture: ComponentFixture<TabComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TabComponent] });
    fixture = TestBed.createComponent(TabComponent);
    host = fixture.nativeElement;
  });

  it('is hidden by default', () => {
    fixture.detectChanges();
    expect(host.style.display).toBe('none');
  });

  describe('label input', () => {
    it('defaults to empty string', () => {
      fixture.detectChanges();
      expect(fixture.componentInstance.label()).toBe('');
    });

    it('reflects set value', () => {
      fixture.componentRef.setInput('label', 'My Tab');
      fixture.detectChanges();
      expect(fixture.componentInstance.label()).toBe('My Tab');
    });
  });

  describe('icon input', () => {
    it('defaults to null', () => {
      fixture.detectChanges();
      expect(fixture.componentInstance.icon()).toBeNull();
    });

    it('reflects set value', () => {
      fixture.componentRef.setInput('icon', 'star');
      fixture.detectChanges();
      expect(fixture.componentInstance.icon()).toBe('star');
    });
  });

  describe('disabled input', () => {
    it('defaults to false', () => {
      fixture.detectChanges();
      expect(fixture.componentInstance.disabled()).toBe(false);
    });

    it('reflects true when set', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(fixture.componentInstance.disabled()).toBe(true);
    });
  });
});
