import { TreeDirective, TreeNodeDefDirective, TreeNodeDirective } from './headless';
import { TreeComponent } from './tree.component';

export const TREE_IMPORTS = [TreeComponent, TreeDirective, TreeNodeDirective, TreeNodeDefDirective] as const;
