export interface ThemeColorMap {
  default: string;
  hover: string;
  focus?: string;
  active: string;
  disabled: string;
}

export interface Theme {
  name: string;
  isDefault?: boolean;
  color: ThemeColorMap;
  onColor: ThemeColorMap;
}
