export type NgClassType =
  | string
  | string[]
  | Set<string>
  | {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [klass: string]: any;
    }
  | null
  | undefined;
