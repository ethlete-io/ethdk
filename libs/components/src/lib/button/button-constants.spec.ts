import '../../test-helpers';
import { BUTTON_ICON_ALIGNMENTS, BUTTON_SIZES, BUTTON_SPINNER_CONFIG, BUTTON_VARIANTS } from './button.component';

describe('Button Constants', () => {
  describe('BUTTON_SIZES', () => {
    it('exports all button sizes', () => {
      expect(BUTTON_SIZES).toHaveProperty('XS');
      expect(BUTTON_SIZES).toHaveProperty('SM');
      expect(BUTTON_SIZES).toHaveProperty('MD');
      expect(BUTTON_SIZES).toHaveProperty('LG');
      expect(BUTTON_SIZES).toHaveProperty('XL');
    });

    it('has correct size values', () => {
      expect(BUTTON_SIZES.XS).toBe('xs');
      expect(BUTTON_SIZES.SM).toBe('sm');
      expect(BUTTON_SIZES.MD).toBe('md');
      expect(BUTTON_SIZES.LG).toBe('lg');
      expect(BUTTON_SIZES.XL).toBe('xl');
    });
  });

  describe('BUTTON_VARIANTS', () => {
    it('exports all button variants', () => {
      expect(BUTTON_VARIANTS).toHaveProperty('FILLED');
      expect(BUTTON_VARIANTS).toHaveProperty('OUTLINE');
      expect(BUTTON_VARIANTS).toHaveProperty('TONAL');
      expect(BUTTON_VARIANTS).toHaveProperty('TRANSPARENT');
    });

    it('has correct variant values', () => {
      expect(BUTTON_VARIANTS.FILLED).toBe('filled');
      expect(BUTTON_VARIANTS.OUTLINE).toBe('outline');
      expect(BUTTON_VARIANTS.TONAL).toBe('tonal');
      expect(BUTTON_VARIANTS.TRANSPARENT).toBe('transparent');
    });
  });

  describe('BUTTON_ICON_ALIGNMENTS', () => {
    it('exports all icon alignments', () => {
      expect(BUTTON_ICON_ALIGNMENTS).toHaveProperty('START');
      expect(BUTTON_ICON_ALIGNMENTS).toHaveProperty('END');
    });

    it('has correct alignment values', () => {
      expect(BUTTON_ICON_ALIGNMENTS.START).toBe('start');
      expect(BUTTON_ICON_ALIGNMENTS.END).toBe('end');
    });
  });

  describe('BUTTON_SPINNER_CONFIG', () => {
    it('exports spinner config for all sizes', () => {
      expect(BUTTON_SPINNER_CONFIG).toHaveProperty('xs');
      expect(BUTTON_SPINNER_CONFIG).toHaveProperty('sm');
      expect(BUTTON_SPINNER_CONFIG).toHaveProperty('md');
      expect(BUTTON_SPINNER_CONFIG).toHaveProperty('lg');
      expect(BUTTON_SPINNER_CONFIG).toHaveProperty('xl');
    });

    it('has correct config values for each size', () => {
      expect(BUTTON_SPINNER_CONFIG.xs).toEqual({ diameter: 12, strokeWidth: 1.5 });
      expect(BUTTON_SPINNER_CONFIG.sm).toEqual({ diameter: 14, strokeWidth: 1.75 });
      expect(BUTTON_SPINNER_CONFIG.md).toEqual({ diameter: 16, strokeWidth: 2 });
      expect(BUTTON_SPINNER_CONFIG.lg).toEqual({ diameter: 20, strokeWidth: 2.5 });
      expect(BUTTON_SPINNER_CONFIG.xl).toEqual({ diameter: 24, strokeWidth: 3 });
    });

    it('has diameter and strokeWidth properties', () => {
      Object.values(BUTTON_SPINNER_CONFIG).forEach((config) => {
        expect(config).toHaveProperty('diameter');
        expect(config).toHaveProperty('strokeWidth');
        expect(typeof config.diameter).toBe('number');
        expect(typeof config.strokeWidth).toBe('number');
      });
    });
  });
});
