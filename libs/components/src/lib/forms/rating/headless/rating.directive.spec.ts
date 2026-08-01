import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { RatingDirective } from './rating.directive';
import { RATING_IMPORTS } from '../rating.imports';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: {
        default: '0 0 0',
        disabled: '0 36 23',
      },
    },
  },
  {
    name: 'red',
    type: 'error' as const,
    primary: {
      color: {
        default: '255 0 0',
        hover: '255 76 76',
        focus: '255 76 76',
        active: '198 0 0',
        disabled: '128 32 32',
      },
      onColor: {
        default: '0 0 0',
        disabled: '48 0 0',
      },
    },
  },
] as const;

@Component({
  template: `
    <et-rating
      [value]="value()"
      [mixed]="mixed()"
      [mixedLabel]="mixedLabel()"
      [allowHalf]="allowHalf()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [max]="4"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
    >
      <et-label>Test label</et-label>
    </et-rating>
  `,
  imports: [RATING_IMPORTS, LabelDirective],
})
class RatingTestHost {
  value = signal<number | null>(null);
  mixed = signal(false);
  mixedLabel = signal('Mixed');
  allowHalf = signal(false);
  disabled = signal(false);
  readonly = signal(false);
}

describe('RatingDirective', () => {
  let fixture: ComponentFixture<RatingTestHost>;
  let host: HTMLElement;

  const keydown = (key: string) => {
    host.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  const icons = () => Array.from(host.querySelectorAll<HTMLElement>('.et-rating-row:first-of-type .et-rating-icon'));
  const fillVars = () => {
    const container = host.querySelector<HTMLElement>('.et-rating-icons')!;

    return {
      icons: container.style.getPropertyValue('--_et-rating-fill-icons'),
      gaps: container.style.getPropertyValue('--_et-rating-fill-gaps'),
    };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RatingTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(RatingTestHost);
    fixture.detectChanges();
    host = fixture.nativeElement.querySelector('et-rating');
  });

  it('renders a slider with one icon per step and an empty fill', () => {
    expect(host.getAttribute('role')).toBe('slider');
    expect(host.getAttribute('aria-valuemin')).toBe('0');
    expect(host.getAttribute('aria-valuemax')).toBe('4');
    expect(host.getAttribute('aria-valuetext')).toBe('No rating');
    expect(icons().length).toBe(4);
    // base row + fill overlay row
    expect(host.querySelectorAll('.et-rating-row').length).toBe(2);
    expect(fillVars()).toEqual({ icons: '0', gaps: '0' });
  });

  it('reflects the value in the continuous fill width and aria', () => {
    fixture.componentInstance.value.set(3);
    fixture.detectChanges();

    // 3 icon widths + the 2 gaps the fill crosses
    expect(fillVars()).toEqual({ icons: '3', gaps: '2' });
    expect(host.getAttribute('aria-valuenow')).toBe('3');
    expect(host.getAttribute('aria-valuetext')).toBe('3 of 4');
  });

  it('renders half values as a mid-icon fill width', () => {
    fixture.componentInstance.allowHalf.set(true);
    fixture.componentInstance.value.set(2.5);
    fixture.detectChanges();

    expect(fillVars()).toEqual({ icons: '2.5', gaps: '2' });
    expect(host.getAttribute('aria-valuetext')).toBe('2.5 of 4');
  });

  it('steps with arrow keys, clamps at max and clears below the first step', () => {
    keydown('ArrowRight');
    expect(fixture.componentInstance.value()).toBe(1);

    keydown('ArrowRight');
    keydown('ArrowRight');
    keydown('ArrowRight');
    keydown('ArrowRight');
    expect(fixture.componentInstance.value()).toBe(4);

    keydown('ArrowLeft');
    expect(fixture.componentInstance.value()).toBe(3);

    keydown('Home');
    expect(fixture.componentInstance.value()).toBe(1);

    keydown('ArrowLeft');
    expect(fixture.componentInstance.value()).toBeNull();

    keydown('End');
    expect(fixture.componentInstance.value()).toBe(4);

    keydown('Backspace');
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('uses half steps for keyboard when allowHalf is set', () => {
    fixture.componentInstance.allowHalf.set(true);
    fixture.detectChanges();

    keydown('ArrowRight');
    expect(fixture.componentInstance.value()).toBe(0.5);

    keydown('ArrowRight');
    expect(fixture.componentInstance.value()).toBe(1);
  });

  it('commits on icon click and clears when the current value is picked again', () => {
    icons()[2]!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(3);

    icons()[2]!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('ignores interaction while disabled or readonly', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    icons()[1]!.click();
    keydown('ArrowRight');
    expect(fixture.componentInstance.value()).toBeNull();
    expect(host.getAttribute('tabindex')).toBe('-1');

    fixture.componentInstance.disabled.set(false);
    fixture.componentInstance.readonly.set(true);
    fixture.detectChanges();

    icons()[1]!.click();
    keydown('ArrowRight');
    expect(fixture.componentInstance.value()).toBeNull();
    expect(host.getAttribute('tabindex')).toBe('0');
  });

  describe('mixed', () => {
    beforeEach(() => {
      fixture.componentInstance.value.set(3);
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();
    });

    it('fills no icons, removes aria-valuenow and announces the mixed label', () => {
      expect(fillVars()).toEqual({ icons: '0', gaps: '0' });
      expect(host.hasAttribute('aria-valuenow')).toBe(false);
      expect(host.getAttribute('aria-valuetext')).toBe('Mixed');
      expect(host.getAttribute('data-mixed')).toBe('true');

      fixture.componentInstance.mixedLabel.set('Different ratings');
      fixture.detectChanges();

      expect(host.getAttribute('aria-valuetext')).toBe('Different ratings');
    });

    it('keeps the hover preview working over the masked value', () => {
      const rating = fixture.debugElement.children[0]!.injector.get(RatingDirective);

      rating.setHoverValue(2);
      fixture.detectChanges();

      expect(fillVars()).toEqual({ icons: '2', gaps: '1' });

      rating.clearHover();
      fixture.detectChanges();

      expect(fillVars()).toEqual({ icons: '0', gaps: '0' });
      expect(fixture.componentInstance.mixed()).toBe(true);
    });

    it('always commits a pick - even the hidden raw value - instead of clearing by repick', () => {
      icons()[2]!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBe(3);
      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(host.getAttribute('aria-valuenow')).toBe('3');

      // resolved - the normal clear-by-repick behavior is back
      icons()[2]!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBeNull();
    });

    it('starts keyboard steps from the visible zero and resolves on the first write', () => {
      keydown('ArrowRight');

      expect(fixture.componentInstance.value()).toBe(1);
      expect(fixture.componentInstance.mixed()).toBe(false);
    });

    it('clears to null and resolves via Backspace or Delete', () => {
      keydown('Delete');

      expect(fixture.componentInstance.value()).toBeNull();
      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(host.getAttribute('aria-valuetext')).toBe('No rating');
    });

    it('stays mixed across external value writes and ignored interactions', () => {
      fixture.componentInstance.value.set(2);
      fixture.detectChanges();

      expect(fixture.componentInstance.mixed()).toBe(true);
      expect(fillVars()).toEqual({ icons: '0', gaps: '0' });

      fixture.componentInstance.readonly.set(true);
      fixture.detectChanges();

      icons()[1]!.click();
      keydown('ArrowRight');

      expect(fixture.componentInstance.mixed()).toBe(true);
      expect(fixture.componentInstance.value()).toBe(2);
    });
  });
});

describe('RatingDirective (mixed contract)', () => {
  describeMixedStateContract(() => {
    TestBed.configureTestingModule({
      imports: [RatingTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    const fixture = TestBed.createComponent(RatingTestHost);

    fixture.detectChanges();

    const hostElement = fixture.nativeElement.querySelector('et-rating') as HTMLElement;
    const icons = () =>
      Array.from(hostElement.querySelectorAll<HTMLElement>('.et-rating-row:first-of-type .et-rating-icon'));

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set(3);
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
      },
      rawValue: () => 3,
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => hostElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set(1);
        fixture.detectChanges();
      },
      externallyWrittenValue: () => 1,
      commit: () => {
        icons()[1]!.click();
        fixture.detectChanges();
      },
      committedValue: () => 2,
      assertMasked: () => {
        expect(hostElement.hasAttribute('aria-valuenow')).toBe(false);
        expect(hostElement.getAttribute('aria-valuetext')).toBe('Mixed');
      },
      clear: () => {
        hostElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
        fixture.detectChanges();
      },
      emptyValue: () => null,
    };
  });
});
