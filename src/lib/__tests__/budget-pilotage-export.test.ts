import { describe, expect, it } from "vitest";
import { buildPilotageWorkbook } from "../budget-pilotage-export";
import { computeFiscalYearSummary } from "../budget-pilotage";
import { pilotageAction, post } from "./budget-fixtures";

describe("pilotage Excel export", () => {
  it("exports the commission comment immediately after matrix notes", () => {
    const actions = [{ ...pilotageAction(), postCode: post.code, fencingCategories: [],
      notes: "Note de la matrice", comment: "Décision de la commission" }];
    const summary = computeFiscalYearSummary({
      fiscalYear: { label: "2026", restitutionAmount: 0 }, posts: [post], actions,
    });
    const sheet = buildPilotageWorkbook({ summary, actions, vigilance: [] }).getWorksheet("Actions")!;
    expect(sheet.getRow(1).getCell(17).value).toBe("Notes");
    expect(sheet.getRow(1).getCell(18).value).toBe("Commentaire");
    expect(sheet.getRow(2).getCell(17).value).toBe("Note de la matrice");
    expect(sheet.getRow(2).getCell(18).value).toBe("Décision de la commission");
    expect(sheet.getRow(2).getCell(9).value).toBe(100);
  });
});
