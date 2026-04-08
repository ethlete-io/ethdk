import { InjectionToken, Signal } from '@angular/core';
import { StreamPipEntry } from '../../stream-manager.types';

export const PIP_ENTRY_TOKEN = new InjectionToken<Signal<StreamPipEntry>>('PIP_ENTRY_TOKEN');
