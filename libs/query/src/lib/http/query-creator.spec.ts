import { QueryArgs, RawResponseType, RequestArgs, ResponseType } from './query';
import { QueryCreator, RequiresTransform } from './query-creator';
import { QueryFeature, withArgs, WithArgsQueryFeature } from './query-features';

describe('query creator', () => {
  describe('RequestArgs type', () => {
    it('should omit response metadata from request arguments', () => {
      type TransformedArgs = {
        response: string;
        rawResponse: { data: string };
        body: { id: number };
      };

      const requestArgs: RequestArgs<TransformedArgs> = { body: { id: 1 } };

      expectTypeOf<RequestArgs<TransformedArgs>>().toEqualTypeOf<{ body: { id: number } }>();
      expect(requestArgs).toEqual({ body: { id: 1 } });
    });
  });

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

    it('should return response type when the args declare no rawResponse', () => {
      expectTypeOf<RawResponseType<{ response: string }>>().toEqualTypeOf<string>();
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

  describe('withArgs type check', () => {
    type UserArgs = { response: { id: string }; pathParams: { id: string } };
    type OptionalPathParamsArgs = { response: string; pathParams?: { id: string } };
    type ListArgs = { response: string[]; queryParams: { page: number } };

    const typeOnly = (
      getUser: QueryCreator<UserArgs>,
      getOptional: QueryCreator<OptionalPathParamsArgs>,
      getList: QueryCreator<ListArgs>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getAny: QueryCreator<any>,
      features: QueryFeature<UserArgs>[],
      log: QueryFeature<UserArgs>,
    ) => {
      getUser(withArgs(() => ({ pathParams: { id: '1' } })));
      getUser(
        log,
        withArgs(() => ({ pathParams: { id: '1' } })),
      );
      getUser(
        { key: 'user' },
        withArgs(() => ({ pathParams: { id: '1' } })),
      );
      getUser(withArgs((): null => null));
      getUser(...features);
      getUser({ key: 'user' }, ...features);
      getUser({ silenceMissingWithArgsFeatureError: true });
      getUser({ silenceMissingWithArgsFeatureError: true }, log);
      getOptional();
      getList();
      getList(withArgs(() => ({ queryParams: { page: 1 } })));
      getAny();

      // @ts-expect-error pathParams without withArgs
      getUser();
      // @ts-expect-error pathParams without withArgs
      getUser(log);
      // @ts-expect-error pathParams without withArgs
      getUser({ key: 'user' });
      // @ts-expect-error the silence flag has to be the literal true
      getUser({ silenceMissingWithArgsFeatureError: false });
      // @ts-expect-error silenced and withArgs at once
      getUser(
        { silenceMissingWithArgsFeatureError: true },
        withArgs(() => ({ pathParams: { id: '1' } })),
      );
      // @ts-expect-error the route needs an id
      getUser(withArgs(() => ({ pathParams: {} })));
    };

    const typeOnlyCallSites = (getUser: QueryCreator<UserArgs>, log: QueryFeature<UserArgs>) => {
      const api = { getUser };
      const { getUser: extracted } = api;
      const stored = getUser;
      const forward = <T extends QueryArgs>(creator: QueryCreator<T>, ...features: QueryFeature<T>[]) =>
        creator(...features);

      class UserService {
        readonly getUser = getUser;
        readonly user = this.getUser(withArgs(() => ({ pathParams: { id: '1' } })));
        // @ts-expect-error pathParams without withArgs
        readonly broken = this.getUser();
      }

      api.getUser(withArgs(() => ({ pathParams: { id: '1' } })));
      extracted(withArgs(() => ({ pathParams: { id: '1' } })));
      stored(withArgs(() => ({ pathParams: { id: '1' } })));
      forward(
        getUser,
        withArgs(() => ({ pathParams: { id: '1' } })),
      );

      // @ts-expect-error pathParams without withArgs
      api.getUser();
      // @ts-expect-error pathParams without withArgs
      extracted(log);
      // @ts-expect-error the flag has to be the literal true, not boolean
      getUser({ silenceMissingWithArgsFeatureError: Boolean(log) });

      return UserService;
    };

    const typeOnlyGenericHelpers = (getUser: QueryCreator<UserArgs>) => {
      const withGenericArgs = <T extends QueryArgs>(creator: QueryCreator<T>, args: () => RequestArgs<T>) =>
        creator(withArgs(args));
      const withGenericArgsAndConfig = <T extends QueryArgs>(creator: QueryCreator<T>, args: () => RequestArgs<T>) =>
        creator({ key: 'user' }, withArgs(args));
      const silencedGeneric = <T extends QueryArgs>(creator: QueryCreator<T>) =>
        creator({ silenceMissingWithArgsFeatureError: true });
      // @ts-expect-error without withArgs, a generic TArgs cannot be proven to lack pathParams
      const withoutArgsGeneric = <T extends QueryArgs>(creator: QueryCreator<T>) => creator();
      const silencedWithArgsGeneric = <T extends QueryArgs>(creator: QueryCreator<T>, args: () => RequestArgs<T>) =>
        // @ts-expect-error silenced and withArgs at once
        creator({ silenceMissingWithArgsFeatureError: true }, withArgs(args));

      withGenericArgs(getUser, () => ({ pathParams: { id: '1' } }));

      return [withGenericArgsAndConfig, silencedGeneric, withoutArgsGeneric, silencedWithArgsGeneric];
    };

    const typeOnlyAnnotations = (getUser: QueryCreator<UserArgs>) => {
      const annotated: WithArgsQueryFeature<UserArgs> = withArgs(() => ({ pathParams: { id: '1' } }));
      const widened: QueryFeature<UserArgs> = withArgs(() => ({ pathParams: { id: '1' } }));

      getUser(annotated);
      // @ts-expect-error a plain QueryFeature annotation drops the withArgs mark
      getUser(widened);
    };

    it('only runs in tsc', () => {
      expect(typeof typeOnly).toBe('function');
      expect(typeof typeOnlyCallSites).toBe('function');
      expect(typeof typeOnlyGenericHelpers).toBe('function');
      expect(typeof typeOnlyAnnotations).toBe('function');
    });
  });
});
