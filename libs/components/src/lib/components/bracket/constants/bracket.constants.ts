import { InjectionToken } from '@angular/core';
import { BracketConfig, BracketMatch, BracketRound } from '../types';

export const BRACKET_CONFIG_TOKEN = new InjectionToken<BracketConfig>('BRACKET_CONFIG_TOKEN');
export const BRACKET_ROUND_DATA_TOKEN = new InjectionToken<BracketRound>('BRACKET_ROUND_DATA_TOKEN');
export const BRACKET_MATCH_DATA_TOKEN = new InjectionToken<BracketMatch>('BRACKET_MATCH_DATA_TOKEN');
