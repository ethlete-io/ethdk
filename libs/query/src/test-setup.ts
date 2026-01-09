import '@analogjs/vitest-angular/setup-zone';
import '@angular/compiler';

import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

// Suppress console.error for expected error scenarios during tests
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0];
  // Suppress HttpErrorResponse logs
  if (message && typeof message === 'object' && 'name' in message && message.name === 'HttpErrorResponse') {
    return;
  }
  // Suppress bearer token decryption errors
  if (typeof message === 'string' && message.includes('Failed to decrypt bearer token')) {
    return;
  }
  // Suppress token extraction errors
  if (typeof message === 'string' && message.includes('Failed to extract tokens from')) {
    return;
  }
  originalError(...args);
};
