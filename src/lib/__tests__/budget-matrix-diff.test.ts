import { describe, expect, it } from "vitest";
import { buildMatrixDiff, importedActionStatus, labelSimilarity, matchMatrixActions } from "../budget-matrix-diff";
import { normalizeMatrixLabel } from "../budget-matrix";
import { existingAction, matrixAction, parsedMatrix } from "./budget-fixtures";

describe("matrix matching", () => {
  it("keeps Laupheim after a destination annotation and compares Dice tokens", () => {
    const label = "Stage Laupheim M20 avril => novi sad";
    expect(labelSimilarity(label, "Stage Laupheim M20 avril")).toBe(0.8);
    expect(matchMatrixActions([matrixAction({ label, matrixKey: normalizeMatrixLabel(label) })], [existingAction()])[0]).toMatchObject({ actionId: "old", score: 0.8, matchedBy: "label" });
    expect(labelSimilarity("123", "456")).toBe(0);
  });
  it("matches keys exactly, stays in the post and assigns each existing action only once", () => {
    const rows = [matrixAction(), matrixAction({ rowNumber: 9 }), matrixAction({ rowNumber: 10, postCode: "C" })];
    expect(matchMatrixActions(rows, [existingAction()]).map(match => match.actionId)).toEqual(["old", null, null]);
  });
  it("assigns highest scores first rather than file order, with a minimum of 0.5", () => {
    const rows = [
      matrixAction({ rowNumber: 8, label: "Stage Laupheim M20 avril Novi Sad", matrixKey: "annotated stage" }),
      matrixAction({ rowNumber: 9 }),
      matrixAction({ rowNumber: 10, label: "Tokyo Japon", matrixKey: "japon tokyo" }),
    ];
    expect(matchMatrixActions(rows, [existingAction()]).map(match => match.actionId)).toEqual([null, "old", null]);
  });
  it("reserves explicit matches before greedy matching and honors null creation", () => {
    const rows = [matrixAction(), matrixAction({ rowNumber: 9 })];
    expect(matchMatrixActions(rows, [existingAction()], { 9: "old" }).map(match => match.actionId)).toEqual([null, "old"]);
    expect(matchMatrixActions(rows, [existingAction()], { 8: null }).map(match => match.actionId)).toEqual([null, "old"]);
  });
  it("rejects unknown rows, foreign posts, missing ids and duplicate override assignments", () => {
    const rows = [matrixAction(), matrixAction({ rowNumber: 9 })];
    for (const overrides of [{ 99: null }, { 8: "absent" }, { 8: "old", 9: "old" }] as Array<Record<number, string | null>>) {
      expect(() => matchMatrixActions(rows, [existingAction()], overrides)).toThrow("Rapprochement invalide");
    }
    expect(() => matchMatrixActions(rows, [existingAction({ postCode: "C" })], { 8: "old" })).toThrow();
  });
});
describe("matrix diff and status rules", () => {
  it.each([
    ["CANCELLED", "BUDGETED", "CANCELLED"], ["COMMITTED", "OPTION", "OPTION"], ["COMMITTED", "BUDGETED", "COMMITTED"], ["CANCELLED", "UNBUDGETED", "UNBUDGETED"],
    ["CANCELLED", "DONE", "DONE"], ["COMMITTED", "DONE", "DONE"],
    ["DONE", "BUDGETED", "DONE"], ["UNBUDGETED", "BUDGETED", "BUDGETED"],
  ] as const)("imports %s / %s as %s", (current: Parameters<typeof importedActionStatus>[0], suggested: Parameters<typeof importedActionStatus>[1], expected: string) => {
    expect(importedActionStatus(current, suggested)).toBe(expected);
  });
  it("returns unchanged actions and preserves CANCELLED in the preview", () => {
    const result = buildMatrixDiff(parsedMatrix(), [existingAction({ status: "CANCELLED" })]);
    expect(result.actions[0]).toMatchObject({ kind: "unchanged", changes: [] });
  });
  it("reports modified amounts, labels, post labels, new rows and missing actions", () => {
    const parsed = parsedMatrix([matrixAction({ gross: 6000, label: "Stage Laupheim M20 avril => novi sad" }), matrixAction({ rowNumber: 10, label: "Tokyo", matrixKey: "tokyo" })]);
    parsed.ignoredRows = [{ rowNumber: 50, text: "manama 6000" }];
    parsed.warnings = ["warning"];
    const result = buildMatrixDiff(parsed, [existingAction(), existingAction({ id: "missing", label: "Autre", matrixKey: "autre", matrixLineNumber: null, matrixOccurrence: null })], undefined, [{ code: "B", label: "Ancien libellé" }]);
    expect(result.posts[0]).toMatchObject({ kind: "updated", previousLabel: "Ancien libellé" });
    expect(result.actions[0]).toMatchObject({ kind: "updated", previousLabel: "Stage Laupheim M20 avril" });
    expect(result.actions[0].changes).toContainEqual({ field: "revisedGross", before: 5000, after: 6000 });
    expect(result.actions[1].kind).toBe("new");
    expect(result.missingActions.map(action => action.id)).toEqual(["missing"]);
    expect(result.ignoredRows).toEqual(parsed.ignoredRows);
    expect(result.warnings).toEqual(["warning"]);
    expect(buildMatrixDiff(parsed, []).posts[0].kind).toBe("new");
  });
});


describe("position fallback", () => {
  const rewritten = (overrides = {}) => matrixAction({ label: "Tokyo Japon", matrixKey: "japon tokyo", ...overrides });
  it("matches a rewritten label and exposes the reason in the diff", () => {
    const diff = buildMatrixDiff(parsedMatrix([rewritten()]), [existingAction()]);
    expect(diff.actions[0]).toMatchObject({ actionId: "old", matchedBy: "position", kind: "updated" });
    expect(diff.missingActions).toEqual([]);
  });
  it("distinguishes duplicated numbers by occurrence and stays in the same post", () => {
    const existing = [existingAction(), existingAction({ id: "second", matrixOccurrence: 1 })];
    const rows = [rewritten({ lineOccurrence: 1 }), rewritten({ rowNumber: 9, lineOccurrence: 0 }), rewritten({ rowNumber: 10, postCode: "C" })];
    expect(matchMatrixActions(rows, existing).map(match => match.actionId)).toEqual(["second", "old", null]);
  });
  it("reserves all label matches before positions and never reuses an action", () => {
    const rows = [rewritten(), matrixAction({ rowNumber: 9, lineNumber: 2 }), rewritten({ rowNumber: 10 })];
    expect(matchMatrixActions(rows, [existingAction()]).map(match => match.actionId)).toEqual([null, "old", null]);
    expect(matchMatrixActions([rewritten(), rewritten({ rowNumber: 9 })], [existingAction()]).map(match => match.actionId)).toEqual(["old", null]);
  });
  it("requires both position fields and honors explicit creation and assignment", () => {
    for (const fields of [{ matrixLineNumber: null }, { matrixOccurrence: null }]) {
      expect(matchMatrixActions([rewritten()], [existingAction(fields)])[0].actionId).toBeNull();
    }
    expect(matchMatrixActions([rewritten({ lineNumber: null })], [existingAction()])[0].actionId).toBeNull();
    expect(matchMatrixActions([rewritten()], [existingAction()], { 8: null })[0].actionId).toBeNull();
    const existing = [existingAction(), existingAction({ id: "manual", matrixLineNumber: 2 })];
    expect(matchMatrixActions([rewritten()], existing, { 8: "manual" })[0].actionId).toBe("manual");
  });
  it("includes newly inferred estimates and positions in the preview without replacing manual estimates", () => {
    const parsed = parsedMatrix([matrixAction({ suggestedStatus: "UNBUDGETED", estimatedFederation: 6000 })]);
    expect(buildMatrixDiff(parsed, [existingAction({ matrixLineNumber: null, matrixOccurrence: null })]).actions[0].changes).toEqual(expect.arrayContaining([
      { field: "estimatedFederation", before: null, after: 6000 }, { field: "matrixLineNumber", before: null, after: 1 },
      { field: "matrixOccurrence", before: null, after: 0 },
    ]));
    expect(buildMatrixDiff(parsed, [existingAction({ estimatedFederation: 2000 })]).actions[0].changes.some(change => change.field === "estimatedFederation")).toBe(false);
  });
});
