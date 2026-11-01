import { PartTreeLayer } from '../design-parts/part-tree/part-tree.component';
import { ShellSection } from '../design-parts/shell-main/shell-main.component';

export type PageShell = {
  tree: PartTreeLayer[];
  product: string;
  products: string[];
  project: string;
  projects: string[];
  panel: 'open' | 'hidden';
};

export type PageShellAction =
  | { kind: 'pick'; key: string }
  | { kind: 'collapse' }
  | { kind: 'section'; section: ShellSection }
  | { kind: 'product'; name: string }
  | { kind: 'allProducts' }
  | { kind: 'project'; name: string }
  | { kind: 'openProject' };
