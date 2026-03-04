import { HttpHeaders } from '@angular/common/http';
import { buildQueryCacheKey, extractExpiresInSeconds, shouldCacheQuery } from './query-cache-utils';

describe('query cache utils', () => {
  describe('shouldCacheQuery', () => {
    it('should return true for GET, OPTIONS and HEAD', () => {
      expect(shouldCacheQuery('GET')).toBe(true);
      expect(shouldCacheQuery('OPTIONS')).toBe(true);
      expect(shouldCacheQuery('HEAD')).toBe(true);
    });

    it('should return false for POST, PUT, PATCH and DELETE', () => {
      expect(shouldCacheQuery('POST')).toBe(false);
      expect(shouldCacheQuery('PUT')).toBe(false);
      expect(shouldCacheQuery('PATCH')).toBe(false);
      expect(shouldCacheQuery('DELETE')).toBe(false);
    });
  });

  describe('buildQueryCacheKey', () => {
    it('should return the same key for the same route and args', () => {
      const key1 = buildQueryCacheKey('/api/test', { queryParams: { id: 1 } });
      const key2 = buildQueryCacheKey('/api/test', { queryParams: { id: 1 } });
      expect(key1).toBe(key2);
    });

    it('should return different keys for different routes', () => {
      const key1 = buildQueryCacheKey('/api/test', undefined);
      const key2 = buildQueryCacheKey('/api/other', undefined);
      expect(key1).not.toBe(key2);
    });

    it('should include body in the hash', () => {
      const key1 = buildQueryCacheKey('/api/test', { body: { query: '{ users }' } });
      const key2 = buildQueryCacheKey('/api/test', { body: { query: '{ posts }' } });
      expect(key1).not.toBe(key2);
    });

    it('should return a numeric string', () => {
      const key = buildQueryCacheKey('/api/test', undefined);
      expect(Number.isNaN(Number(key))).toBe(false);
    });
  });

  describe('extractExpiresInSeconds', () => {
    it('should return null when cache-control is no-cache', () => {
      const headers = new HttpHeaders({ 'cache-control': 'no-cache' });
      expect(extractExpiresInSeconds(headers)).toBeNull();
    });

    it('should return max-age/2 as estimate when only max-age is present', () => {
      const headers = new HttpHeaders({ 'cache-control': 'max-age=600' });
      expect(extractExpiresInSeconds(headers)).toBe(300);
    });

    it('should subtract age from max-age when both headers are present', () => {
      const headers = new HttpHeaders({ 'cache-control': 'max-age=600', age: '100' });
      expect(extractExpiresInSeconds(headers)).toBe(500);
    });

    it('should use s-maxage when max-age is absent', () => {
      const headers = new HttpHeaders({ 'cache-control': 's-maxage=400' });
      expect(extractExpiresInSeconds(headers)).toBe(200);
    });

    it('should return 3600 for expires: -1', () => {
      const headers = new HttpHeaders({ expires: '-1' });
      expect(extractExpiresInSeconds(headers)).toBe(3600);
    });

    it('should parse a future expires date header', () => {
      const future = new Date(Date.now() + 60_000);
      const headers = new HttpHeaders({ expires: future.toUTCString() });
      const result = extractExpiresInSeconds(headers);
      expect(result).toBeGreaterThan(50);
      expect(result).toBeLessThanOrEqual(60);
    });

    it('should return null when no cache headers are present', () => {
      const headers = new HttpHeaders();
      expect(extractExpiresInSeconds(headers)).toBeNull();
    });
  });
});
