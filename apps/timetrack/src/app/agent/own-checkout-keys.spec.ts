import { of, throwError } from 'rxjs';
import { HostPorts } from '../../host';
import { ownCheckoutKeys$ } from './own-checkout-keys';

const portsOf = (receivedSettings$: () => unknown) => ({ peers: { receivedSettings$ } }) as unknown as HostPorts;

describe('ownCheckoutKeys$', () => {
  it('answers this machine checkout keys from the received settings', () => {
    const keys = { '/home/a/sdk': 'ethlete-sdk' };
    let answer: unknown;

    ownCheckoutKeys$(portsOf(() => of({ ownRepoKeys: keys, peers: [] }))).subscribe((value) => (answer = value));

    expect(answer).toEqual(keys);
  });

  it('answers no keys when the host cannot read them', () => {
    let answer: unknown;

    ownCheckoutKeys$(portsOf(() => throwError(() => new Error('no shell')))).subscribe((value) => (answer = value));

    expect(answer).toEqual({});
  });
});
