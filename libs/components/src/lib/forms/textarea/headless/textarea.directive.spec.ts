import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { FormFieldDirective, LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountTextarea, TextareaDriver } from '../../testing/textarea-driver';
import { TEXTAREA_IMPORTS } from '../textarea.imports';
import { TextareaDirective } from './textarea.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Message</et-label>
      <textarea etTextarea placeholder="Your message"></textarea>
    </div>
  `,
  imports: [TextareaDirective, FormFieldDirective, LabelDirective],
})
class TextareaInFormFieldTestHost {}

@Component({
  template: `
    <textarea [autosize]="autosize()" [rows]="rows()" [minRows]="minRows()" [maxRows]="maxRows()" etTextarea></textarea>
  `,
  imports: [TextareaDirective],
})
class StandaloneTextareaTestHost {
  autosize = signal(true);
  rows = signal(3);
  minRows = signal<number | null>(null);
  maxRows = signal<number | null>(null);
}

@Component({
  template: `
    <et-textarea
      [value]="value()"
      [mixed]="mixed()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      mixedLabel="Mixed values"
      placeholder="Write here"
    />
  `,
  imports: [TEXTAREA_IMPORTS],
})
class MixedTextareaTestHost {
  value = signal('');
  mixed = signal(false);
}

describe('TextareaDirective', () => {
  describe('inside form field', () => {
    let driver: TextareaDriver<TextareaInFormFieldTestHost>;

    beforeEach(() => {
      driver = mountTextarea(TextareaInFormFieldTestHost, { directiveSelector: '[etTextarea]' });
    });

    it('should register with parent form field', () => {
      expect(driver.directive(FormFieldDirective).registeredControl()).toBeTruthy();
    });

    it('should compute labelId from registered label', () => {
      expect(driver.textarea.labelId()).toMatch(/^et-label-\d+$/);
    });
  });

  describe('value and state', () => {
    let driver: TextareaDriver<StandaloneTextareaTestHost>;

    beforeEach(() => {
      driver = mountTextarea(StandaloneTextareaTestHost);
    });

    it('should have empty value by default', () => {
      expect(driver.textarea.value()).toBe('');
      expect(driver.textarea.hasValue()).toBe(false);
    });

    it('should expose the host textarea as nativeControl', () => {
      expect(driver.textarea.nativeControl()).toBe(driver.field());
    });

    it('should report resize none while autosizing', () => {
      expect(driver.textarea.effectiveResize()).toBe('none');
    });

    it('should honor the resize input when autosize is off', () => {
      driver.host.autosize.set(false);
      driver.tick();

      expect(driver.textarea.effectiveResize()).toBe('vertical');
    });

    it('should clear the inline block-size when autosize is turned off', () => {
      driver.host.autosize.set(false);
      driver.tick();

      expect(driver.blockSize()).toBe('');
    });

    it('should not display error when not touched', () => {
      expect(driver.textarea.shouldDisplayError()).toBe(false);
    });

    describe('native autosize hooks', () => {
      it('should mark the textarea and derive the row floor from rows', () => {
        expect(driver.hasAttr('data-et-textarea-autosize')).toBe(true);
        expect(driver.cssVar('--et-textarea-min-rows')).toBe('3');
      });

      it('should prefer minRows over rows for the row floor', () => {
        driver.host.minRows.set(5);
        driver.tick();

        expect(driver.cssVar('--et-textarea-min-rows')).toBe('5');
      });

      it('should set no upper bound while maxRows is null', () => {
        expect(driver.cssVar('--et-textarea-max-block-size')).toBe('');
      });

      it('should turn maxRows into a line-based upper bound', () => {
        driver.host.maxRows.set(6);
        driver.tick();

        expect(driver.cssVar('--et-textarea-max-block-size')).toBe('calc(6 * 1lh)');
      });

      it('should remove every hook when autosize is turned off', () => {
        driver.host.maxRows.set(6);
        driver.tick();
        driver.host.autosize.set(false);
        driver.tick();

        expect(driver.hasAttr('data-et-textarea-autosize')).toBe(false);
        expect(driver.cssVar('--et-textarea-min-rows')).toBe('');
        expect(driver.cssVar('--et-textarea-max-block-size')).toBe('');
      });
    });
  });

  describe('mixed state', () => {
    const setup = () => {
      const driver = mountTextarea(MixedTextareaTestHost);
      const enterMixed = (rawValue: string) => {
        driver.host.value.set(rawValue);
        driver.host.mixed.set(true);
        driver.tick();
      };

      return { driver, enterMixed };
    };

    describeMixedStateContract(() => {
      const { driver, enterMixed } = setup();

      return {
        enterMixed: () => enterMixed('hidden raw\nsecond line'),
        rawValue: () => 'hidden raw\nsecond line',
        value: () => driver.host.value(),
        mixed: () => driver.host.mixed(),
        hostElement: () => driver.hostEl(),
        writeValueExternally: () => {
          driver.host.value.set('server write');
          driver.tick();
        },
        externallyWrittenValue: () => 'server write',
        resolveMixedFromConsumer: () => {
          driver.host.mixed.set(false);
          driver.tick();
        },
        mixedLabel: () => 'Mixed values',
        mixedDisplayText: () => driver.placeholder(),
        commit: () => driver.type('typed over'),
        committedValue: () => 'typed over',
        assertMasked: () => {
          expect(driver.fieldValue()).toBe('');
          expect(driver.placeholder()).toBe('Mixed values');
        },
      };
    });

    it('masks via the placeholder and restores the consumer placeholder after the commit', () => {
      const { driver, enterMixed } = setup();

      enterMixed('secret');

      expect(driver.fieldValue()).toBe('');
      expect(driver.placeholder()).toBe('Mixed values');

      driver.type('new text');

      expect(driver.fieldValue()).toBe('new text');
      expect(driver.placeholder()).toBe('Write here');
    });

    it('keeps mixed and the raw value when an edit produces no content', () => {
      const { driver, enterMixed } = setup();

      enterMixed('secret');
      driver.type('');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('secret');
    });
  });
});
