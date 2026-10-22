import { FilterOverlayValueOf } from '@ethlete/components';
import { defineQueryForm, queryField } from '@ethlete/query';

export const TEAM_FILTER_FIELDS = {
  search: queryField<string>({ defaultValue: '' }),
  region: queryField<string>({ defaultValue: 'all' }),
  division: queryField<string>({ defaultValue: 'all' }),
  page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'region', 'division'] }),
};

export const createTeamFilters = () => defineQueryForm({ fields: TEAM_FILTER_FIELDS, queryParamPrefix: 'teams' });

export type TeamFilterValue = FilterOverlayValueOf<ReturnType<typeof createTeamFilters>>;

export const REGIONS = ['all', 'eu', 'na', 'apac'];
export const DIVISIONS = ['all', 'first', 'second', 'youth'];

export const REGION_LABELS: Record<string, string> = {
  all: 'All regions',
  eu: 'Europe',
  na: 'North America',
  apac: 'Asia-Pacific',
};

export const DIVISION_LABELS: Record<string, string> = {
  all: 'All divisions',
  first: 'First division',
  second: 'Second division',
  youth: 'Youth',
};

export const TEAMS = [
  { name: 'Chemie Leipzig', region: 'eu', division: 'first' },
  { name: 'Roter Stern Leipzig', region: 'eu', division: 'second' },
  { name: 'Altona 93', region: 'eu', division: 'youth' },
  { name: 'St. Pauli', region: 'eu', division: 'first' },
  { name: 'Dulwich Hamlet', region: 'eu', division: 'second' },
  { name: 'Rayo Vallecano', region: 'eu', division: 'first' },
  { name: 'Portland Thorns', region: 'na', division: 'first' },
  { name: 'Cascadia United', region: 'na', division: 'second' },
  { name: 'Detroit City', region: 'na', division: 'first' },
  { name: 'Oakland Roots', region: 'na', division: 'second' },
  { name: 'Chattanooga FC', region: 'na', division: 'youth' },
  { name: 'Yokohama FM', region: 'apac', division: 'first' },
  { name: 'Melbourne City', region: 'apac', division: 'youth' },
  { name: 'Wellington Phoenix', region: 'apac', division: 'second' },
  { name: 'Kashima Antlers', region: 'apac', division: 'first' },
  { name: 'Auckland City', region: 'apac', division: 'second' },
];

export const matchTeams = (value: TeamFilterValue) =>
  TEAMS.filter(
    (team) =>
      (!value.search || team.name.toLowerCase().includes(value.search.toLowerCase())) &&
      (!value.region || value.region === 'all' || team.region === value.region) &&
      (!value.division || value.division === 'all' || team.division === value.division),
  );
