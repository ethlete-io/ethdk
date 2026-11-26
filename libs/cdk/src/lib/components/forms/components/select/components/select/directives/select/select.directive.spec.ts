import { ESCAPE } from '@angular/cdk/keycodes';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { AnimatedOverlayDirective } from '../../../../../../../overlay/directives/animated-overlay';
import { provideValidatorErrorsService } from '../../../../../../services';
import { SelectImports } from '../../select.imports';
import { SelectDirective } from './select.directive';

@Component({
  template: `
    <et-select-field [formControl]="control">
      <et-select>
        <et-select-option value="a">Apple</et-select-option>
        <et-select-option value="b">Banana</et-select-option>
      </et-select>
    </et-select-field>
  `,
  imports: [SelectImports, ReactiveFormsModule],
})
class SelectHostComponent {
  control = new FormControl<string | null>(null);
}

const setup = async () => {
  TestBed.configureTestingModule({ providers: [provideValidatorErrorsService()] });

  const fixture = TestBed.createComponent(SelectHostComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const select = fixture.debugElement.query(By.directive(SelectDirective));
  const overlay = select.injector.get(AnimatedOverlayDirective);
  const input = fixture.nativeElement.querySelector('.et-select-input') as HTMLElement;

  return { fixture, overlay, input };
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

describe('SelectDirective close during the enter animation', () => {
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
    const { overlay, input } = await setup();

    input.click();
    await settle();

    expect(overlay.state()).toBe('mounted');
    expect(input.getAttribute('aria-expanded')).toBe('true');

    pressEscape(input);
    await settle();
  });

  it('closes on an Escape pressed right after the opening click', async () => {
    const { overlay, input } = await setup();

    input.click();
    expect(overlay.state()).toBe('mounting');

    pressEscape(input);
    await settle();

    expect(overlay.state()).toBe('unmounted');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});
