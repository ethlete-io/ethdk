import type { NewChangeset, VersionType } from "@changesets/types";
import { describe, expect, it } from "vitest";
import { planRun } from "./plan.ts";

const changeset = (...types: VersionType[]): NewChangeset => ({
  id: types.join("-"),
  summary: "",
  releases: types.map((type, index) => ({ name: `pkg-${index}`, type })),
});

describe("planRun", () => {
  it("publishes and opens no PR when only none changesets are pending", () => {
    expect(
      planRun({ changesets: [changeset("none")], hasPublishScript: true }),
    ).toEqual({ publish: true, version: false });
  });

  it("publishes and updates the PR when a changeset bumps a package", () => {
    expect(
      planRun({
        changesets: [changeset("none"), changeset("none", "patch")],
        hasPublishScript: true,
      }),
    ).toEqual({ publish: true, version: true });
  });

  it("does not publish without a publish script", () => {
    expect(planRun({ changesets: [], hasPublishScript: false })).toEqual({
      publish: false,
      version: false,
    });
  });
});
