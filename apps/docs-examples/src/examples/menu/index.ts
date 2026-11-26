export const MENU_EXAMPLES = {
  'menu/menu-default': () => import('./menu-default.example').then((m) => m.MenuDefaultExampleComponent),
  'menu/menu-context': () => import('./menu-context.example').then((m) => m.MenuContextExampleComponent),
  'menu/menu-selection': () => import('./menu-selection.example').then((m) => m.MenuSelectionExampleComponent),
  'menu/menu-search-async': () => import('./menu-search-async.example').then((m) => m.MenuSearchAsyncExampleComponent),
};
