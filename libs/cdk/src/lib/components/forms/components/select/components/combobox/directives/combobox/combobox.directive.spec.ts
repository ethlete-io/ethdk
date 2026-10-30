import { ESCAPE } from '@angular/cdk/keycodes';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { AnimatedOverlayDirective } from '../../../../../../../overlay/directives/animated-overlay';
import { provideValidatorErrorsService } from '../../../../../../services';
import { ComboboxImports } from '../../combobox.imports';
import { ComboboxDirective } from './combobox.directive';

@Component({
  template: `
    <et-select-field [formControl]="control">
      <et-combobox [options]="options" [multiple]="false" bindLabel="label" bindValue="value" />
    </et-select-field>
  `,
  imports: [ComboboxImports, ReactiveFormsModule],
})
class ComboboxHostComponent {
  control = new FormControl<string | null>(null);
  options = [
    { label: 'Apple', value: 'a' },
    { label: 'Banana', value: 'b' },
  ];
}

const setup = async () => {
  TestBed.configureTestingModule({ providers: [provideValidatorErrorsService()] });

  const fixture = TestBed.createComponent(ComboboxHostComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const combobox = fixture.debugElement.query(By.directive(ComboboxDirective));
  const overlay = combobox.injector.get(AnimatedOverlayDirective);
  const host = combobox.nativeElement as HTMLElement;
  const input = host.querySelector('input') as HTMLInputElement;

  return { overlay, host, input };
};

const pressEscape = (target: HTMLElement) => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

  Object.defineProperty(event, 'keyCode', { value: ESCAPE });
  target.dispatchEvent(event);
};

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await vi.advanceTimersByTimeAsync(100);
    TestBed.tick();
  }
};

describe('ComboboxDirective close during the enter animation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(async () => {
    await settle();
    vi.useRealTimers();
    delete (Element.prototype as Partial<Element>).scrollTo;
  });

  it('stays open after the opening click', async () => {
    const { overlay, host, input } = await setup();

    host.click();
    await settle();

    expect(overlay.state()).toBe('mounted');

    pressEscape(input);
    await settle();
  });

  it('closes on an Escape pressed right after the opening click', async () => {
    const { overlay, host, input } = await setup();

    host.click();
    expect(overlay.state()).toBe('mounting');

    pressEscape(input);
    await settle();

    expect(overlay.state()).toBe('unmounted');
  });

  it('ignores an outside click before the overlay is mounted', async () => {
    const { overlay, host } = await setup();

    host.click();
    expect(overlay.state()).toBe('mounting');

    document.body.click();
    await vi.advanceTimersByTimeAsync(10);
    TestBed.tick();

    expect(overlay.state()).not.toBe('unmounting');
    expect(overlay.state()).not.toBe('unmounted');

    await settle();
    expect(overlay.state()).toBe('mounted');
  });
});
