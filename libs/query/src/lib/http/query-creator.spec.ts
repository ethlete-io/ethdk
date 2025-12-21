import { QueryArgs, RawResponseType, ResponseType } from './query';
import { RequiresTransform } from './query-creator';

describe('query creator', () => {
  describe('RequiresTransform type', () => {
    it('should return false when rawResponse is undefined', () => {
      type TestArgs = {
        response: string;
      };

      type Result = RequiresTransform<TestArgs>;
      const result: Result = false;

      expect(result).toBe(false);
    });

    it('should return false when rawResponse equals response', () => {
      type TestArgs = {
        response: string;
        rawResponse: string;
      };

      type Result = RequiresTransform<TestArgs>;
      const result: Result = false;

      expect(result).toBe(false);
    });

    it('should return true when rawResponse differs from response', () => {
      type TestArgs = {
        response: number;
        rawResponse: string;
      };

      type Result = RequiresTransform<TestArgs>;
      const result: Result = true;

      expect(result).toBe(true);
    });

    it('should return true when rawResponse is object and response is primitive', () => {
      type TestArgs = {
        response: number;
        rawResponse: { data: number };
      };

      type Result = RequiresTransform<TestArgs>;
      const result: Result = true;

      expect(result).toBe(true);
    });
  });

  describe('RawResponseType', () => {
    it('should return response type when rawResponse is undefined', () => {
      type TestArgs = QueryArgs & {
        response: string;
      };

      type Result = RawResponseType<TestArgs>;
      const result: Result = 'test';

      expect(typeof result).toBe('string');
    });

    it('should return rawResponse type when defined', () => {
      type TestArgs = QueryArgs & {
        response: number;
        rawResponse: { data: number };
      };

      type Result = RawResponseType<TestArgs>;
      const result: Result = { data: 42 };

      expect(result).toEqual({ data: 42 });
    });
  });

  describe('ResponseType', () => {
    it('should return response type', () => {
      type TestArgs = QueryArgs & {
        response: string;
      };

      type Result = ResponseType<TestArgs>;
      const result: Result = 'test';

      expect(typeof result).toBe('string');
    });

    it('should return response type even when rawResponse is defined', () => {
      type TestArgs = QueryArgs & {
        response: number;
        rawResponse: { data: number };
      };

      type Result = ResponseType<TestArgs>;
      const result: Result = 42;

      expect(typeof result).toBe('number');
    });
  });
});
