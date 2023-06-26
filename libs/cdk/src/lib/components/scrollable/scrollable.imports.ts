import {
  IsActiveElementDirective,
  IsElementDirective,
  ScrollObserverFirstElementDirective,
  ScrollObserverIgnoreTargetDirective,
  ScrollObserverLastElementDirective,
} from '@ethlete/core';
import { ScrollableComponent } from './components';

export const ScrollableImports = [
  ScrollableComponent,
  IsElementDirective,
  IsActiveElementDirective,
  ScrollObserverFirstElementDirective,
  ScrollObserverLastElementDirective,
  ScrollObserverIgnoreTargetDirective,
] as const;
