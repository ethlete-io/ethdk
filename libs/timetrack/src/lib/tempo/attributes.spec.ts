import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TimetrackRequest, TimetrackTransport } from '../transport/ports';
import {
  TempoWorkAttribute,
  canHoldWorklogMarker,
  fetchTempoWorkAttributes$,
  findMarkerAttribute,
  missingRequiredAttributes,
} from './attributes';
import { TempoCredentials } from './client';

const CREDENTIALS: TempoCredentials = { token: 't' };

const attributeTransport = (results: unknown[]) => {
  const requests: TimetrackRequest[] = [];
  const transport: TimetrackTransport = {
    request$: vi.fn((request: TimetrackRequest) => {
      requests.push(request);

      return of({ status: 200, headers: {}, body: { results, metadata: {} } }) as never;
    }),
  };

  return { transport, requests };
};

const attribute = (overrides: Partial<TempoWorkAttribute>): TempoWorkAttribute => ({
  key: '_Billable_',
  name: 'Billable',
  type: 'CHECKBOX',
  required: false,
  values: [],
  ...overrides,
});

describe('fetchTempoWorkAttributes$', () => {
  it('reads the schema endpoint', () => {
    const { transport, requests } = attributeTransport([]);

    fetchTempoWorkAttributes$({ transport, credentials: CREDENTIALS }).subscribe();

    expect(requests[0]?.url).toContain('/4/work-attributes');
  });

  it('normalizes an attribute and defaults its name and requiredness', () => {
    const { transport } = attributeTransport([{ key: '_Category_', type: 'STATIC_LIST', values: ['Dev', 'Ops', 7] }]);
    const seen = vi.fn();

    fetchTempoWorkAttributes$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([
      { key: '_Category_', name: '_Category_', type: 'STATIC_LIST', required: false, values: ['Dev', 'Ops'] },
    ]);
  });

  it('drops an attribute of a type this version does not model', () => {
    const { transport } = attributeTransport([
      { key: '_Odd_', name: 'Odd', type: 'SOMETHING_NEW' },
      { key: '_Billable_', name: 'Billable', type: 'CHECKBOX', required: true },
    ]);
    const seen = vi.fn();

    fetchTempoWorkAttributes$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([
      { key: '_Billable_', name: 'Billable', type: 'CHECKBOX', required: true, values: [] },
    ]);
  });

  it('drops an attribute with no key', () => {
    const { transport } = attributeTransport([{ name: 'Nameless', type: 'CHECKBOX' }]);
    const seen = vi.fn();

    fetchTempoWorkAttributes$({ transport, credentials: CREDENTIALS }).subscribe(seen);

    expect(seen.mock.calls[0]?.[0]).toEqual([]);
  });
});

describe('missingRequiredAttributes', () => {
  const attributes = [
    attribute({ key: '_Billable_', required: true }),
    attribute({ key: '_Account_', type: 'ACCOUNT', required: true }),
    attribute({ key: '_Note_', type: 'INPUT_TEXT' }),
  ];

  it('reports every required attribute the values do not answer', () => {
    const missing = missingRequiredAttributes({ attributes, values: { _Billable_: true } });

    expect(missing.map((entry) => entry.key)).toEqual(['_Account_']);
  });

  it('treats an empty string as unanswered but keeps a false checkbox', () => {
    const missing = missingRequiredAttributes({
      attributes,
      values: { _Billable_: false, _Account_: '' },
    });

    expect(missing.map((entry) => entry.key)).toEqual(['_Account_']);
  });

  it('never reports an optional attribute', () => {
    expect(missingRequiredAttributes({ attributes: [attribute({ key: '_Note_' })], values: {} })).toEqual([]);
  });
});

describe('findMarkerAttribute', () => {
  it('only accepts a free-text attribute nobody else is required to fill in', () => {
    expect(canHoldWorklogMarker(attribute({ type: 'INPUT_TEXT' }))).toBe(true);
    expect(canHoldWorklogMarker(attribute({ type: 'INPUT_TEXT', required: true }))).toBe(false);
    expect(canHoldWorklogMarker(attribute({ type: 'STATIC_LIST' }))).toBe(false);
  });

  it('prefers the configured key when the instance offers several', () => {
    const found = findMarkerAttribute({
      attributes: [attribute({ key: '_First_', type: 'INPUT_TEXT' }), attribute({ key: '_Mine_', type: 'INPUT_TEXT' })],
      preferredKey: '_Mine_',
    });

    expect(found?.key).toBe('_Mine_');
  });

  it('falls back to the first usable attribute', () => {
    const found = findMarkerAttribute({
      attributes: [attribute({ key: '_Billable_' }), attribute({ key: '_Note_', type: 'INPUT_TEXT' })],
      preferredKey: '_Absent_',
    });

    expect(found?.key).toBe('_Note_');
  });

  it('finds nothing when the instance has no free-text attribute, so the marker must go in the description', () => {
    expect(findMarkerAttribute({ attributes: [attribute({ key: '_Billable_' })] })).toBeUndefined();
  });
});
