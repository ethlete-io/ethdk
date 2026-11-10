import { existsSync } from 'fs';
import { join } from 'path';
import { ResolvedProduct } from './resolve-product';

const LEFTOVER_FILES = ['go.json', 'accepted.json'];

export const leftoverGateFilesWarningOf = (product: ResolvedProduct): string | null => {
  const files = LEFTOVER_FILES.filter((file) => existsSync(join(product.dir, file)));

  return files.length === 0
    ? null
    : `WARNING LEFTOVER-FILE ${product.name}: ${files.join(', ')} ${files.length === 1 ? 'is' : 'are'} no longer read - ` +
        `build-ready replaced go and accept; delete ${files.map((file) => join(product.dir, file)).join(', ')}`;
};
