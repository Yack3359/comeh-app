import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMatrixWorkbook } from "../budget-matrix-export";
import { parseBudgetMatrix, type ParsedMatrix } from "../budget-matrix";
import { matrixWorkbook } from "./budget-fixtures";

const load = vi.hoisted(() => vi.fn());
const authenticate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/budget-pilotage-query", () => ({ loadPilotage: load }));
vi.mock("@/lib/api-auth", () => ({ runAsAuthenticatedUser: authenticate }));
import { GET } from "@/app/api/pilotage/export-matrix/route";

type Input = Parameters<typeof buildMatrixWorkbook>[0];
const fileName = "Matrice EH 2026 au 25.10.26.xlsx";
function input(): Input {
  const action: Input["actions"][number] = { postId: "b", label: "Stage avril", matrixLineNumber: 7, origin: "RENEWED",
    includedInBudget: true, proposedSaving: false, revisedGross: 1000.25, revisedClubIncome: 200.15, revisedFederation: 800.1,
    previousYearAmount: 900, actualGross: 500, actualClubIncome: 100, actualFederation: 400, notes: "Accord du club" };
  return { fiscalYearLabel: "2026", asOfDate: new Date("2026-10-25"), restitutionAmount: 1234.56,
    posts: [{ id: "b", code: "B", label: "Stages" }, { id: "c", code: "C", label: "Compétitions" }],
    actions: [action, { ...action, label: "Stage OPTION", matrixLineNumber: 9, origin: "NEW", includedInBudget: false,
      previousYearAmount: null, actualGross: null, actualClubIncome: null, actualFederation: null, notes: null },
    { ...action, postId: "c", label: "Compétition décembre", matrixLineNumber: null, origin: null, proposedSaving: true,
      revisedGross: 600, revisedClubIncome: 0, revisedFederation: 600, actualGross: 0, actualClubIncome: 0, actualFederation: 0 }] };
}
const parse = async (workbook: ReturnType<typeof buildMatrixWorkbook>, name = fileName) =>
  parseBudgetMatrix(Buffer.from(await workbook.xlsx.writeBuffer()), name);
function fromParsed(matrix: ParsedMatrix): Input {
  return { fiscalYearLabel: matrix.fiscalYearLabel!, asOfDate: new Date(matrix.asOfDate!), restitutionAmount: matrix.restitutionAmount ?? 0,
    posts: matrix.posts.map(post => ({ id: post.code, code: post.code, label: post.label })),
    actions: matrix.actions.map(action => ({ postId: action.postCode, label: action.label, matrixLineNumber: action.lineNumber, origin: action.origin,
      includedInBudget: action.includedInBudget, proposedSaving: action.proposedSaving, revisedGross: action.gross!, revisedClubIncome: action.clubIncome!,
      revisedFederation: action.federation!, previousYearAmount: action.previousYear, actualGross: action.actualGross,
      actualClubIncome: action.actualClubIncome, actualFederation: action.actualFederation, notes: action.notes })) };
}

describe("export au format matrice FFE", () => {
  it("conserve exercice, date, restitution, postes et actions sans avertissement", async () => {
    const data = input(), workbook = buildMatrixWorkbook(data);
    const result = await parse(workbook);
    expect(result.warnings).toEqual([]);
    expect(result).toMatchObject({ sheetName: "EH 2026", fiscalYearLabel: "2026", asOfDate: "2026-10-25", restitutionAmount: 1234.56 });
    expect(result.posts.map(({ code, label }) => ({ code, label }))).toEqual(data.posts.map(({ code, label }) => ({ code, label })));
    expect(result.actions).toHaveLength(3);
    data.actions.forEach((action, index) => expect(result.actions[index]).toMatchObject({
      postCode: data.posts.find(post => post.id === action.postId)!.code, label: action.label, lineNumber: action.matrixLineNumber ?? 1,
      origin: action.origin, includedInBudget: action.includedInBudget, proposedSaving: action.proposedSaving,
      gross: action.revisedGross, clubIncome: action.revisedClubIncome, federation: action.revisedFederation,
      previousYear: action.previousYearAmount, actualGross: action.actualGross, actualClubIncome: action.actualClubIncome,
      actualFederation: action.actualFederation, notes: action.notes,
    }));
    const sheet = workbook.worksheets[0];
    expect(workbook.worksheets).toHaveLength(1);
    expect(sheet.getCell("D4").value).toEqual({ formula: "SUM(D5)", result: 1000.25 });
    expect(sheet.getCell("D3").value).toEqual({ formula: "SUM(D4,D8)", result: 1600.25 });
    expect(sheet.getCell("D10").value).toEqual({ formula: "SUM(D5,D6,D9)", result: 2600.5 });
    for (const column of ["D", "E", "F", "J", "K", "L"]) {
      expect(sheet.getCell(column + "4").formula).toBe("SUM(" + column + "5)");
      expect(sheet.getColumn(column).numFmt).toBe('# ##0 €');
    }
    expect(sheet.getCell("G6").value).toBeNull();
    expect(sheet.getCell("J6").value).toBeNull();
    for (let column = 3; column <= 14; column++) expect(sheet.getRow(9).getCell(column).fill).toEqual({ type: "pattern", pattern: "solid", fgColor: { argb: "FF0099FF" } });
    expect(sheet.views).toEqual([{ state: "frozen", ySplit: 3 }]);
    expect(sheet.getColumn("C").width).toBe(60);
    expect(sheet.getCell("C4").font).toMatchObject({ name: "Arial", size: 10, bold: true });
    sheet.eachRow(row => row.eachCell(cell => { if (cell.type === 6) expect(typeof cell.result).toBe("number"); }));
  });
  it("laisse le sous-total vide de références quand aucune action n’est incluse", async () => {
    const data = input();
    data.actions = data.actions.map(action => ({ ...action, includedInBudget: false }));
    const workbook = buildMatrixWorkbook(data);
    const cell = workbook.worksheets[0].getCell("D4");
    expect(cell.formula).toBe("SUM(0)");
    expect(cell.result).toBe(0);
    // Le parseur existant traite une liste vide comme une formule absente.
    const result = await parse(workbook);
    expect(result.warnings).toHaveLength(2);
    expect(result.actions[0].includedInBudget).toBe(true);
  });
  it("laisse le réel FFE nul vide même si le parseur le déduit ensuite du brut", async () => {
    const data = input();
    data.actions[0].actualFederation = null;
    const workbook = buildMatrixWorkbook(data);
    expect(workbook.worksheets[0].getCell("L5").value).toBeNull();
    expect((await parse(workbook)).actions[0].actualFederation).toBe(400);
  });
  it("relit la date dans l’en-tête et dans le nom de fichier", async () => {
    const workbook = buildMatrixWorkbook(input());
    expect((await parse(workbook, "matrice.xlsx")).asOfDate).toBe("2026-10-25");
    workbook.worksheets[0].getCell("J1").value = "REALISE";
    expect((await parse(workbook)).asOfDate).toBe("2026-10-25");
  });
  it("restitue les actions du classeur d’exemple avec leurs montants et leur inclusion", async () => {
    const original = await parse(matrixWorkbook());
    const result = await parse(buildMatrixWorkbook(fromParsed(original)));
    const comparable = (matrix: ParsedMatrix) => matrix.actions.map(({ postCode, label, gross, clubIncome, federation, previousYear, actualGross, actualClubIncome, actualFederation, includedInBudget, proposedSaving, origin, notes }) =>
      ({ postCode, label, gross, clubIncome, federation, previousYear, actualGross, actualClubIncome, actualFederation, includedInBudget, proposedSaving, origin, notes }));
    expect(result.warnings).toEqual([]);
    expect(comparable(result)).toEqual(comparable(original));
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  authenticate.mockImplementation((operation: () => Promise<unknown>) => operation());
  const data = input();
  load.mockResolvedValue({ fiscalYear: { label: data.fiscalYearLabel, restitutionAmount: data.restitutionAmount }, asOfDate: data.asOfDate, posts: data.posts, actions: data.actions });
});
describe("route d’export matrice FFE", () => {
  it("renvoie 404 pour un exercice inconnu", async () => {
    load.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/pilotage/export-matrix?fiscalYear=2025"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Exercice 2025 introuvable" });
    expect(load).toHaveBeenCalledWith("2025");
  });
  it("renvoie un classeur lisible avec le nom et les en-têtes attendus", async () => {
    const response = await GET(new Request("http://localhost/api/pilotage/export-matrix?fiscalYear=2026"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="' + fileName + '"');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const result = await parseBudgetMatrix(await response.arrayBuffer(), fileName);
    expect(result.warnings).toEqual([]);
    expect(result.actions).toHaveLength(3);
    expect(result.restitutionAmount).toBe(1234.56);
    expect(load).toHaveBeenCalledWith("2026");
    expect(authenticate).toHaveBeenCalledOnce();
  });
  it("refuse un exercice invalide avant de charger les données", async () => {
    expect((await GET(new Request("http://localhost/api/pilotage/export-matrix?fiscalYear=invalide"))).status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });
});
