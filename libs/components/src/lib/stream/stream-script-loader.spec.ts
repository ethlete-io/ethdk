import { CSP_NONCE, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectStreamScriptLoader } from './stream-script-loader';

const SRC = 'https://example.com/sdk.js';

const scriptOf = () => TestBed.inject(DOCUMENT).head.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);

describe('StreamScriptLoader', () => {
  afterEach(() => scriptOf()?.remove());

  it('should put the CSP nonce on the script it loads', () => {
    TestBed.configureTestingModule({ providers: [{ provide: CSP_NONCE, useValue: 'provided' }] });

    TestBed.runInInjectionContext(() => injectStreamScriptLoader())
      .load(SRC)
      .subscribe();

    expect(scriptOf()?.getAttribute('nonce')).toBe('provided');
  });

  it('should load the script without a nonce when there is none', () => {
    TestBed.runInInjectionContext(() => injectStreamScriptLoader())
      .load(SRC)
      .subscribe();

    expect(scriptOf()?.hasAttribute('nonce')).toBe(false);
  });
});
