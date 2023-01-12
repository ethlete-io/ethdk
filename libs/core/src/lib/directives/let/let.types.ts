export class LetContext<T = unknown> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  public $implicit: T = null!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  public etLet: T = null!;
}
