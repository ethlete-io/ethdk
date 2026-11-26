import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { textOf } from '../../testing/driver-core';
import { SkeletonComponent } from '../skeleton.component';

const ITEM = '.et-skeleton-item';
const TEXT_LINE = '.et-skeleton-text .et-skeleton-item';

export const createSkeletonDriver = <T>(fixture: ComponentFixture<T>, options: ControlDriverOptions = {}) => {
  const base = createControlDriver(fixture, SkeletonComponent, options);

  const itemEls = () => base.queryAll(ITEM);

  return {
    ...base,
    skeleton: base.control,

    allyText: () => textOf(base.query('.et-skeleton-ally-text')),
    itemEls,
    itemShapes: () => itemEls().map((el) => el.getAttribute('data-shape')),
    textLineWidths: () => base.queryAll(TEXT_LINE).map((el) => el.style.getPropertyValue('inline-size')),
  };
};

export type SkeletonDriver<T> = ReturnType<typeof createSkeletonDriver<T>>;

export const mountSkeleton = <T>(component: Type<T>, options: ControlDriverOptions = {}, providers: Provider[] = []) =>
  createSkeletonDriver(mountControl(component, providers), options);
