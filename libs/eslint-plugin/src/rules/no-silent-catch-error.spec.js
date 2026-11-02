// @ts-check
'use strict';

const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-silent-catch-error');

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
});

const error = [{ messageId: 'silentCatchError' }];

tester.run('no-silent-catch-error', rule, {
  valid: [
    { code: `a$.pipe(catchError((e) => { this.error.set(e); return of(null); }));` },
    { code: `a$.pipe(catchError((e) => throwError(() => e)));` },
    { code: `a$.pipe(catchError((e) => { console.error(e); return EMPTY; }));` },
    { code: `a$.pipe(catchError(({ message }) => of(message)));` },
    { code: `a$.pipe(catchError(() => other$));` },
    { code: `a$.pipe(catchError(handle));` },
    { code: `a$.pipe(catchError(() => { const inner = () => of(1); return inner(); }));` },
    { code: `a$.pipe(map(() => of(1)));` },
    { code: `a$.pipe(catchError((e) => { if (x) { return of(1); } return throwError(() => e); }));` },
  ],
  invalid: [
    { code: `a$.pipe(catchError(() => of(null)));`, errors: error },
    { code: `a$.pipe(catchError(() => EMPTY));`, errors: error },
    { code: `a$.pipe(catchError(() => NEVER));`, errors: error },
    { code: `a$.pipe(catchError((e) => of([])));`, errors: error },
    { code: `a$.pipe(catchError(function () { return of(1); }));`, errors: error },
    { code: `a$.pipe(catchError(() => { this.x.set(1); return EMPTY; }));`, errors: error },
  ],
});
