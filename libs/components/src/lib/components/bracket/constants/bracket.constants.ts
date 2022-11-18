import { InjectionToken } from '@angular/core';
import { BracketComponent } from '../public-api';
import { BracketConfig } from '../types';

export const BRACKET_TOKEN = new InjectionToken<BracketComponent>('BRACKET_TOKEN');
export const BRACKET_CONFIG_TOKEN = new InjectionToken<BracketConfig>('BRACKET_CONFIG_TOKEN');
export const BRACKET_ROUND_ID_TOKEN = new InjectionToken<string>('BRACKET_ROUND_ID_TOKEN');
export const BRACKET_MATCH_ID_TOKEN = new InjectionToken<string>('BRACKET_MATCH_ID_TOKEN');
