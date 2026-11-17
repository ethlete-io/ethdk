const RealDate = Date;
const evening = new RealDate();

evening.setHours(17, 40, 0, 0);

const offsetMs = evening.getTime() - RealDate.now();

class DemoDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(RealDate.now() + offsetMs);
    else super(...(args as [number, number, number, number, number, number, number]));
  }
}

DemoDate.now = () => RealDate.now() + offsetMs;

export const installDemoClock = () => {
  globalThis.Date = DemoDate as DateConstructor;
};
