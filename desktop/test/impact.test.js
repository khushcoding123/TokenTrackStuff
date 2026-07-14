const { test } = require("node:test");
const assert = require("node:assert/strict");

const impactModule = import("../../src/core/usage/impact.js");

test("usage impact scales the published benchmark by request count", async () => {
  const { estimateUsageImpact } = await impactModule;
  const impact = estimateUsageImpact({
    requests: 100,
    totalTokens: 1_000_000,
    wastedTokens: 100_000,
  });

  assert.equal(impact.estimated.energyWh, 24);
  assert.equal(impact.estimated.waterMl, 26);
  assert.equal(impact.estimated.carbonG, 3);
  assert.equal(impact.efficiencyPct, 90);
  assert.equal(impact.potentiallyAvoidable.waterMl, 2.6);
});

test("usage impact clamps invalid waste and handles missing requests", async () => {
  const { estimateUsageImpact } = await impactModule;
  const impact = estimateUsageImpact({
    requests: 0,
    totalTokens: 1_000,
    wastedTokens: 2_000,
  });

  assert.equal(impact.available, false);
  assert.equal(impact.wastedTokens, 1_000);
  assert.equal(impact.efficiencyPct, 0);
  assert.equal(impact.estimated.waterMl, 0);
});
