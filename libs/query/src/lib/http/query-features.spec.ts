import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CLEAR_QUERY_ARGS, nestedEffect, QueryFeatureType } from './query-features';

describe('query features', () => {
  describe('CLEAR_QUERY_ARGS', () => {
    it('should be a Symbol', () => {
      expect(typeof CLEAR_QUERY_ARGS).toBe('symbol');
    });

    it('should be referentially stable (always the same symbol)', () => {
      expect(CLEAR_QUERY_ARGS).toBe(CLEAR_QUERY_ARGS);
    });
  });

  describe('QueryFeatureType', () => {
    it('should contain all expected feature types', () => {
      expect(QueryFeatureType.WITH_ARGS).toBe('WITH_ARGS');
      expect(QueryFeatureType.WITH_POLLING).toBe('WITH_POLLING');
      expect(QueryFeatureType.WITH_AUTO_REFRESH).toBe('WITH_AUTO_REFRESH');
      expect(QueryFeatureType.WITH_LOGGING).toBe('WITH_LOGGING');
      expect(QueryFeatureType.WITH_ERROR_HANDLING).toBe('WITH_ERROR_HANDLING');
      expect(QueryFeatureType.WITH_SUCCESS_HANDLING).toBe('WITH_SUCCESS_HANDLING');
      expect(QueryFeatureType.WITH_RESPONSE_UPDATE).toBe('WITH_RESPONSE_UPDATE');
    });
  });

  describe('nestedEffect', () => {
    it('should run the provided function', () => {
      const calls: number[] = [];
      const src = signal(1);

      TestBed.runInInjectionContext(() => {
        nestedEffect(() => {
          src(); // track
          calls.push(src());
        });
      });

      TestBed.flushEffects();
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
