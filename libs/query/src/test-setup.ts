import '@analogjs/vitest-angular/setup-serializers';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';
import { applyStrictTestEnvironment } from '../../../tools/testing/strict-test-environment';

setupTestBed();
applyStrictTestEnvironment();

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
