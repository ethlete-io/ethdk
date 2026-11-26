export type NgClassType =
  | string
  | string[]
  | Set<string>
  | {
      [klass: string]: any;
    }
  | null
  | undefined;
