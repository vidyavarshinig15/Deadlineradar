import test from "node:test";
import assert from "node:assert/strict";
import { getRisk } from "./risk.js";

const today = new Date(2026, 9, 13, 12);
const base = { dueDate: new Date(2026, 9, 20, 15), difficulty: "Easy", completionPercentage: 0, status: "Pending" };

test("scores a seven-day easy assignment as medium risk", () => {
  assert.deepEqual(getRisk(base, today), {
    riskScore: 55,
    riskLevel: "Medium",
    riskExplanation: "Medium risk: This easy assignment is due in 7 days and is 0% complete.",
    daysRemaining: 7
  });
});

test("classifies low remaining work with a distant easy deadline as low risk", () => {
  const result = getRisk({ ...base, dueDate: new Date(2026, 10, 2, 15), completionPercentage: 50 }, today);
  assert.equal(result.riskScore, 30);
  assert.equal(result.riskLevel, "Low");
});

test("scores a hard assignment due tomorrow with low progress", () => {
  const result = getRisk({ ...base, dueDate: new Date(2026, 9, 14, 20), difficulty: "Hard", completionPercentage: 20 }, today);
  assert.equal(result.riskScore, 94);
  assert.equal(result.riskLevel, "High");
});

test("completed work always has zero risk", () => {
  const result = getRisk({ ...base, status: "Completed", completionPercentage: 100 }, today);
  assert.equal(result.riskScore, 0);
  assert.equal(result.riskLevel, "Completed");
});

test("same-calendar-day due date has zero days remaining", () => {
  const result = getRisk({ ...base, dueDate: new Date(2026, 9, 13, 23, 59) }, today);
  assert.equal(result.daysRemaining, 0);
});

test("overdue assignments receive maximum deadline points", () => {
  const result = getRisk({ ...base, dueDate: new Date(2026, 9, 12, 12), completionPercentage: 90 }, today);
  assert.equal(result.daysRemaining, -1);
  assert.equal(result.riskScore, 53);
});
