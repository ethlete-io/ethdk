import '@analogjs/vitest-angular/setup-serializers';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';
import { applyStrictTestEnvironment } from '../../../tools/testing/strict-test-environment';

setupTestBed();
applyStrictTestEnvironment();
