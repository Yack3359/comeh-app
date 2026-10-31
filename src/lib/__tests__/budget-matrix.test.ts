import { describe, expect, it } from "vitest";
import { inferEstimateFromLabel, inferFencingCategories, inferPlannedMonth, normalizeMatrixLabel, parseBudgetMatrix } from "../budget-matrix";
import { computeActionFigures, computeFiscalYearSummary, isActionSettled } from "../budget-pilotage";
import { matrixWorkbook, pilotageAction } from "./budget-fixtures";

describe("parseBudgetMatrix", () => {
  it("reads the FFE layout, cached formulas, inclusions and ignored footer without merging duplicate numbers", async () => {
    const parsed = await parseBudgetMatrix(await matrixWorkbook().xlsx.writeBuffer());
    expect(parsed.fiscalYearLabel).toBe("2026");
    expect(parsed.asOfDate).toBe("2026-10-25");
    expect(parsed.posts.map(post => post.code)).toEqual(["A", "B", "C", "D", "E"]);
    expect(parsed.posts.map(post => post.kind)).toEqual(["OPERATING", "TRAINING_CAMP", "COMPETITION", "TRAINING_CAMP", "COMPETITION"]);
    expect(parsed.posts[1].totals.gross).toBe(5500);
    expect(parsed.grandTotals).toEqual({ gross: 100000, clubIncome: 30000, federation: 70000 });
    const row = (number: number) => parsed.actions.find(action => action.rowNumber === number)!;
    expect(row(14)).toMatchObject({ label: "6 Regroupements (INSEP) OPTION", includedInBudget: false, suggestedStatus: "OPTION", origin: "RENEWED", notes: "x" });
    expect(row(15).includedInBudget).toBe(false);
    expect(row(34)).toMatchObject({ includedInBudget: true, suggestedStatus: "BUDGETED" });
    expect(row(9)).toMatchObject({ origin: "NEW", actualFederation: 9628, suggestedStatus: "DONE" });
    expect(row(18)).toMatchObject({ federation: 11000, actualFederation: 6662, actualClubIncome: 13640 });
    expect(row(25)).toMatchObject({ includedInBudget: false, suggestedStatus: "UNBUDGETED", gross: 0, clubIncome: 0, federation: 0, estimatedFederation: 27000, plannedMonth: 12 });
    expect(row(28)).toMatchObject({ lineNumber: 1, lineOccurrence: 0, proposedSaving: true, gross: 1574, fencingCategories: ["M17"] });
    expect(row(29)).toMatchObject({ lineNumber: 1, lineOccurrence: 1, fencingCategories: ["M20"] });
    expect(row(33).lineNumber).toBe(row(35).lineNumber);
    expect(parsed.ignoredRows.filter(row => row.rowNumber > 57).map(row => row.text)).toEqual(["VERIFICATION | 0", "manama 6000", "FUJARIAH PROV 2025 12013.81"]);
    expect(parsed.warnings).toEqual([expect.stringContaining("poste D")]);
  });
  it("warns for missing headers and formulas, uses filename dates and the first sheet", async () => {
    const workbook = matrixWorkbook(), sheet = workbook.worksheets[0];
    sheet.name = "Matrice";
    sheet.getCell("C1").value = null;
    sheet.getCell("J1").value = null;
    sheet.getCell("D7").value = { formula: "SUM(E8:E13)", result: 5500 };
    workbook.addWorksheet("EH 2027");
    const parsed = await parseBudgetMatrix(await workbook.xlsx.writeBuffer(), "Matrice au 9-10-26.xlsx");
    expect(parsed.fiscalYearLabel).toBeNull();
    expect(parsed.asOfDate).toBe("2026-10-09");
    expect(parsed.warnings).toEqual(expect.arrayContaining([expect.stringContaining("realise"), expect.stringContaining("poste B")]));
    expect(parsed.actions.find(row => row.rowNumber === 14)?.includedInBudget).toBe(false);
  });
  it("distinguishes zero from empty, reads shared formulas, rounds amounts and accepts ArrayBuffer", async () => {
    const workbook = matrixWorkbook(), sheet = workbook.worksheets[0];
    sheet.getCell("D8").value = { formula: "100/3", result: 33.33333 };
    sheet.getCell("D9").value = { sharedFormula: "D8", result: 33.33333 };
    sheet.getCell("F9").value = null;
    sheet.getCell("J8").value = 0;
    sheet.getCell("E8").value = { richText: [{ text: "1 " }, { text: "000,25" }] };
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parseBudgetMatrix(Uint8Array.from(buffer).buffer);
    expect(parsed.actions.find(row => row.rowNumber === 8)).toMatchObject({ gross: 33.33, clubIncome: 1000.25, federation: -966.92, actualFederation: 0, suggestedStatus: "DONE" });
    expect(parsed.actions.find(row => row.rowNumber === 9)?.gross).toBe(33.33);
  });
  it("rejects malformed Excel and does not normalize impossible dates", async () => {
    await expect(parseBudgetMatrix(Buffer.from("invalid"))).rejects.toThrow();
    const workbook = matrixWorkbook();
    workbook.worksheets[0].getCell("J1").value = "REALISÉ AU 31/02/2026";
    expect((await parseBudgetMatrix(await workbook.xlsx.writeBuffer())).asOfDate).toBeNull();
  });
});
describe("matrix inference", () => {
  it.each([
    ["M17/M20", "Stages séniors", ["M20", "M17"]],
    ["Stage", "Stages M20-M17", ["M20", "M17"]],
    ["Stage sénior", "", ["SENIOR"]],
    ["U23 M13 M15 M13", "M20", ["U23", "M15", "M13"]],
    ["XM17", "Autre", []],
  ] as Array<[string, string, string[]]>)("infers categories from %s", (label: string, post: string, expected: string[]) => expect(inferFencingCategories(label, post)).toEqual(expected));
  it.each([
    ["08-10/05", 5], ["16 au 20/04", 4], ["Formia 11/26", 11], ["Berne 12/26", 12],
    ["15-17 Fev", 2], ["JANVIER", 1], ["févr.", 2], ["mars", 3], ["avr", 4], ["mai", 5],
    ["juin", 6], ["juillet", 7], ["août", 8], ["septembre", 9], ["octobre", 10], ["nov", 11],
    ["décembre", 12], ["mai puis avril", 5], ["12/04 puis janvier", 4], ["inconnu", null], ["31/99", null],
  ] as Array<[string, number | null]>)("infers month from %s", (label: string, expected: number | null) => expect(inferPlannedMonth(label)).toBe(expected));
  it("normalizes punctuation, accents, stopwords, numbers and repeated tokens", () => {
    expect(normalizeMatrixLabel("Épée, stage M20 à Paris Paris 12/26 => FAIT OPTION 3 pers cadres FFE")).toBe("epee m20 paris stage");
  });
});


describe("Lot 1a-bis parser regressions", () => {
  it("excludes unnumbered actions inside and outside subtotals and extracts restitution", async () => {
    const parsed = await parseBudgetMatrix(await matrixWorkbook().xlsx.writeBuffer());
    expect(parsed.restitutionAmount).toBe(5000);
    for (const [rowNumber, estimatedFederation] of [[25, 27000], [39, 6000], [46, 6000]]) {
      expect(parsed.actions.find(action => action.rowNumber === rowNumber)).toMatchObject({
        lineNumber: null, lineOccurrence: null, suggestedStatus: "UNBUDGETED", includedInBudget: false,
        gross: 0, clubIncome: 0, federation: 0, estimatedFederation,
      });
    }
    expect(parsed.actions.find(action => action.rowNumber === 33)?.lineOccurrence).toBe(0);
    expect(parsed.actions.find(action => action.rowNumber === 35)?.lineOccurrence).toBe(1);
    expect(parsed.actions.find(action => action.rowNumber === 18)).toMatchObject({ suggestedStatus: "DONE", estimatedFederation: null });
    expect(parsed.actions.find(action => action.rowNumber === 26)).toMatchObject({ actualGross: null, actualClubIncome: null, actualFederation: null, suggestedStatus: "BUDGETED" });
    expect(parsed.actions.find(action => action.rowNumber === 5)).toMatchObject({ actualFederation: 2544, suggestedStatus: "BUDGETED" });
  });
  it("keeps unnumbered rows unbudgeted even with actuals or a typed zero in F", async () => {
    const workbook = matrixWorkbook(), sheet = workbook.worksheets[0];
    sheet.getCell("F39").value = 0;
    sheet.getCell("E39").value = 100;
    sheet.getCell("J39").value = 50;
    const parsed = await parseBudgetMatrix(await workbook.xlsx.writeBuffer());
    expect(parsed.actions.find(action => action.rowNumber === 39)).toMatchObject({
      suggestedStatus: "UNBUDGETED", includedInBudget: false, gross: 0, clubIncome: 0, federation: 0, actualGross: 50,
    });
  });
  it("reads zero formulas as empty in every action amount, but keeps typed zero and nonzero formulas", async () => {
    const workbook = matrixWorkbook(), sheet = workbook.worksheets[0];
    for (const column of ["D", "E", "F", "G", "J", "K", "L"]) sheet.getCell(column + "8").value = { formula: "SUM(H8:I8)", result: 0 };
    sheet.getCell("D8").value = 0;
    sheet.getCell("L9").value = { sharedFormula: "L8", result: 0 };
    sheet.getCell("J9").value = null;
    sheet.getCell("L28").value = { formula: "4244+(500)", result: 4744 };
    const parsed = await parseBudgetMatrix(await workbook.xlsx.writeBuffer());
    expect(parsed.actions.find(action => action.rowNumber === 8)).toMatchObject({
      gross: 0, clubIncome: null, federation: 0, previousYear: null,
      actualGross: null, actualClubIncome: null, actualFederation: null, suggestedStatus: "BUDGETED",
    });
    expect(parsed.actions.find(action => action.rowNumber === 9)?.actualFederation).toBeNull();
    expect(parsed.actions.find(action => action.rowNumber === 28)?.actualFederation).toBe(4744);
  });
  it.each([
    ["Compétition janvier", "REALISE AU 25/10/2026", "DONE"],
    ["Compétition octobre", "REALISE AU 25/10/2026", "BUDGETED"],
    ["Compétition décembre", "REALISE AU 25/10/2026", "BUDGETED"],
    ["INSEP (HON et ITA) + Almeira (13k)", "REALISE AU 25/10/2026", "BUDGETED"],
    ["Compétition décembre => FÂIT", "REALISE AU 25/10/2026", "DONE"],
    ["Compétition décembre forfait", "REALISE AU 25/10/2026", "BUDGETED"],
    ["Compétition janvier", "", "BUDGETED"],
    ["Compétition décembre", "REALISE AU 01/01/2027", "DONE"],
    ["Compétition janvier", "REALISE AU 25/10/2025", "BUDGETED"],
  ])("classifies %s at %s", async (label, header, suggestedStatus) => {
    const workbook = matrixWorkbook(), sheet = workbook.worksheets[0];
    sheet.getCell("C18").value = label;
    sheet.getCell("J1").value = header;
    const parsed = await parseBudgetMatrix(await workbook.xlsx.writeBuffer());
    expect(parsed.actions.find(action => action.rowNumber === 18)).toMatchObject({ suggestedStatus, estimatedFederation: null });
  });
  it("only completes operating actions when explicitly marked fait", async () => {
    const workbook = matrixWorkbook(), sheet = workbook.worksheets[0];
    sheet.getCell("C5").value = "Frais janvier";
    let parsed = await parseBudgetMatrix(await workbook.xlsx.writeBuffer());
    const operating = parsed.actions.find(action => action.rowNumber === 5)!;
    expect(operating.suggestedStatus).toBe("BUDGETED");
    expect(computeActionFigures({ ...operating, status: operating.suggestedStatus, revisedFederation: operating.federation ?? 0, adjustmentFederation: 0, settled: null }).landing).toBe(7070);
    sheet.getCell("C5").value = "Frais janvier => FAIT";
    parsed = await parseBudgetMatrix(await workbook.xlsx.writeBuffer());
    expect(parsed.actions.find(action => action.rowNumber === 5)?.suggestedStatus).toBe("DONE");
  });
  it.each([
    ["SUM(M4:M56)+5000+ 250.50", 5250.5], ["SUM(M4:M56)+M5000+$M$250", null],
    ["SUM(M4:M56)", null], ["SUM(M4:M56)+0", 0],
  ] as const)("extracts added constants from %s", async (formula, expected) => {
    const workbook = matrixWorkbook();
    workbook.worksheets[0].getCell("M3").value = { formula, result: 0 };
    expect((await parseBudgetMatrix(await workbook.xlsx.writeBuffer())).restitutionAmount).toBe(expected);
  });
  it("does not infer restitution from a typed total", async () => {
    const workbook = matrixWorkbook();
    workbook.worksheets[0].getCell("M3").value = 5000;
    expect((await parseBudgetMatrix(await workbook.xlsx.writeBuffer())).restitutionAmount).toBeNull();
  });
  it.each([
    ["Berne (27K)", 27000], ["Grec => 6k", 6000], ["Almeira (13k)", 13000],
    ["6k puis 2,5 K", 2500], ["1.25k", 1250], ["27 euros", null], ["6km", null],
  ] as const)("infers the final estimate in %s", (label, expected) => expect(inferEstimateFromLabel(label)).toBe(expected));
});

describe("worksheet bounds", () => {
  it.each([[2001, 1], [1, 61]])("rejects a sheet extending to row %s / column %s", async (row, column) => {
    const workbook = matrixWorkbook();
    workbook.worksheets[0].getCell(row, column).value = "too large";
    await expect(parseBudgetMatrix(await workbook.xlsx.writeBuffer())).rejects.toThrow("2 000 lignes ou 60 colonnes");
  });
  it("accepts exactly 2000 rows and 60 columns and checks secondary sheets too", async () => {
    const workbook = matrixWorkbook();
    workbook.worksheets[0].getCell(2000, 60).value = "footer";
    await expect(parseBudgetMatrix(await workbook.xlsx.writeBuffer())).resolves.toMatchObject({ fiscalYearLabel: "2026" });
    workbook.addWorksheet("Oversized").getCell(2001, 1).value = "too large";
    await expect(parseBudgetMatrix(await workbook.xlsx.writeBuffer())).rejects.toThrow("2 000 lignes ou 60 colonnes");
  });
});

describe("25 October situation", () => {
  it("settles completed fait and older rows while preserving the matrix actual total", async () => {
    const parsed = await parseBudgetMatrix(await matrixWorkbook().xlsx.writeBuffer());
    const context = { asOfDate: new Date(parsed.asOfDate!), fiscalYearLabel: parsed.fiscalYearLabel! };
    const posts = parsed.posts.map(post => ({ ...post, id: post.code }));
    const actions = parsed.actions.map(row => pilotageAction({
      id: String(row.rowNumber), postId: row.postCode, label: row.label, status: row.suggestedStatus,
      includedInBudget: row.includedInBudget, plannedMonth: row.plannedMonth,
      revisedFederation: row.federation ?? 0, estimatedFederation: row.estimatedFederation, actualFederation: row.actualFederation,
    }));
    const completed = actions.filter(action => action.status === "DONE");
    expect(completed.map(action => action.id)).toEqual(["9", "18"]);
    for (const action of completed) {
      expect(isActionSettled(action, context)).toBe(true);
      expect(computeActionFigures(action, context).remaining).toBe(0);
    }
    const summary = computeFiscalYearSummary({ fiscalYear: { label: "2026", restitutionAmount: parsed.restitutionAmount! }, posts, actions, asOfDate: context.asOfDate });
    expect(summary.totals.actual).toBe(18834);
    expect(summary.totals.actual).toBe(parsed.actions.reduce((sum, action) => sum + (action.actualFederation ?? 0), 0));
    expect(summary.totals.landing - summary.totals.actual).toBe(summary.totals.remaining);
  });
});
