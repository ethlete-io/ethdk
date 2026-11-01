import { PartTreeLayer } from '../design-parts/part-tree/part-tree.component';
import { ShellAction, ShellState } from '../design-parts/shell-main/shell-page.component';

export type PageShell = ShellState & { tree: PartTreeLayer[] };

export type PageShellAction = ShellAction | { kind: 'pick'; key: string };
