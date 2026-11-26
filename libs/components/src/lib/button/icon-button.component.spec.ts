import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { BUTTON_SIZES, BUTTON_VARIANTS } from './button.types';
import { IconButtonComponent } from './icon-button.component';

describe('IconButtonComponent', () => {
  let fixture: ComponentFixture<IconButtonComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IconButtonComponent] });
    fixture = TestBed.createComponent(IconButtonComponent);
    host = fixture.nativeElement;
  });

  describe('variant', () => {
    it('defaults to data-variant="transparent"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-variant')).toBe('transparent');
    });

    it('reflects custom variant in data-variant', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.FILLED);
      fixture.detectChanges();
      expect(host.getAttribute('data-variant')).toBe('filled');
    });
  });

  describe('size', () => {
    it('defaults to data-size="md"', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('md');
    });

    it('reflects custom size in data-size', () => {
      fixture.componentRef.setInput('size', BUTTON_SIZES.LG);
      fixture.detectChanges();
      expect(host.getAttribute('data-size')).toBe('lg');
    });
  });

  describe('loading state', () => {
    it('does not render the spinner by default', () => {
      fixture.detectChanges();
      expect(host.querySelector('et-spinner')).toBeNull();
    });

    it('renders the spinner when loading', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      expect(host.querySelector('et-spinner')).not.toBeNull();
    });
  });

  describe('pressed variant', () => {
    it('has no data-pressed-variant when not pressed', () => {
      fixture.detectChanges();
      expect(host.getAttribute('data-pressed-variant')).toBeNull();
    });

    it('maps transparent to tonal when pressed', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.TRANSPARENT);
      fixture.componentRef.setInput('pressed', true);
      fixture.detectChanges();
      expect(host.getAttribute('data-pressed-variant')).toBe('tonal');
    });

    it('maps filled to transparent when pressed', () => {
      fixture.componentRef.setInput('variant', BUTTON_VARIANTS.FILLED);
      fixture.componentRef.setInput('pressed', true);
      fixture.detectChanges();
      expect(host.getAttribute('data-pressed-variant')).toBe('transparent');
    });
  });

  it('renders icon slot', () => {
    fixture.detectChanges();
    expect(host.querySelector('.et-icon-button-icon')).not.toBeNull();
  });

  describe('content without etIcon', () => {
    @Component({
      imports: [IconButtonComponent],
      template: `
        <button id="unmarked" et-icon-button aria-label="Copy"><i class="glyph"></i></button>
        <button id="marked" et-icon-button aria-label="Edit"><i class="glyph" etIcon></i></button>
      `,
    })
    class HostComponent {}

    const render = async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();
      await hostFixture.whenStable();

      return { warn, element: hostFixture.nativeElement as HTMLElement };
    };

    it('renders the content in the icon slot', async () => {
      const { element } = await render();

      expect(element.querySelector('#unmarked .et-icon-button-icon .glyph')).not.toBeNull();
    });

    it('warns once, for the button whose content lacks etIcon', async () => {
      const { warn, element } = await render();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[1]).toMatchObject({ element: element.querySelector('#unmarked') });
    });
  });
});
