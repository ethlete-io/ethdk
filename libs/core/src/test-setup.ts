import '@analogjs/vitest-angular/setup-serializers';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';
import { applySdkRootFontSize } from '../../../tools/testing/sdk-root-font-size';
import { restoreProcessEmitAfterEachFile } from '../../../tools/testing/restore-process-emit';
import { applyStrictTestEnvironment } from '../../../tools/testing/strict-test-environment';

restoreProcessEmitAfterEachFile();
setupTestBed();
applyStrictTestEnvironment();
applySdkRootFontSize();
