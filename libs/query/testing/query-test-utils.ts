import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const expectAndFlush = <T = unknown>(
  httpTesting: HttpTestingController,
  url: string,
  response: T,
  statusOpts?: { status: number; statusText: string },
): void => {
  const req = httpTesting.expectOne(url);
  if (statusOpts) {
    req.flush(response as any, statusOpts);
  } else {
    req.flush(response as any);
  }
};

export const expectFlushAndWait = <T = unknown>(
  httpTesting: HttpTestingController,
  url: string,
  response: T,
  statusOpts?: { status: number; statusText: string },
): void => {
  expectAndFlush(httpTesting, url, response, statusOpts);
  TestBed.flushEffects();
};
