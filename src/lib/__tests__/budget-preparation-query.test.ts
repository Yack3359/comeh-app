import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { pilotageAction, post } from "./budget-fixtures";

const db = vi.hoisted(() => ({ fiscalYear: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  expense: { groupBy: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
  budgetPost: { findMany: vi.fn() }, budgetAction: { findMany: vi.fn() }, budgetSnapshot: { findFirst: vi.fn(), findMany: vi.fn() } }));
const authenticate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({ runAsAuthenticatedUser: authenticate }));
import { loadPreparation, preparationYearLabel } from "../budget-preparation-query";
import { loadPilotage } from "../budget-pilotage-query";
import { buildPreparationWorkbook } from "../budget-preparation-export";
import { GET as get } from "@/app/api/budget-preparation/route";
import { GET as exportBudget } from "@/app/api/budget-preparation/export/route";
import { hasMinimumRole, roleLabels } from "../permissions";

const decimal = (value: number) => new Prisma.Decimal(value);
const year = { id: "fy", label: "2027", phase: "PREPARATION", preparationDeadline: new Date("2026-12-15"), targetFederation: decimal(240000), restitutionAmount: decimal(0) };
const previous = { ...year, id: "previous", label: "2026", phase: "EXECUTION" };
const action = () => ({ ...pilotageAction(), id: "new", postId: post.id, label: "Doha", initialGross: decimal(0), initialClubIncome: decimal(0), initialFederation: decimal(0),
  revisedGross: decimal(30500), revisedClubIncome: decimal(11000), revisedFederation: decimal(19500), adjustmentFederation: decimal(0), previousYearAmount: decimal(19500),
  actualGross: null, actualFederation: null, actualClubIncome: null, estimatedFederation: null, proposalStatus: "VALIDATED", amountsConfirmed: true,
  fencingCategories: ["M20"], plannedMonth: 2, athleteCount: 4, staffCount: 2, dayCount: 3, comment: "À confirmer avec les clubs",
  status: "OPTION", includedInBudget: false, proposedBy: { name: "Entraîneur" }, post: { ...post, kind: "COMPETITION" },
  sourceAction: { ...pilotageAction(), id: "old", label: "Doha", revisedGross: decimal(30500), revisedClubIncome: decimal(11000), revisedFederation: decimal(19500),
    actualGross: decimal(20657), actualClubIncome: decimal(7017), actualFederation: decimal(13640), initialGross: decimal(30500), initialClubIncome: decimal(11000),
    post: { fiscalYear: { label: "2026" } } },
});
beforeEach(() => {
  vi.resetAllMocks();
  authenticate.mockImplementation((operation: (id: string) => Promise<unknown>) => operation("reader"));
  db.fiscalYear.findUnique.mockImplementation(async ({ where }) => where.label === "2027" ? year : where.label === "2026" ? previous : null);
  db.fiscalYear.findFirst.mockResolvedValue({ label: "2027" });
  db.fiscalYear.findMany.mockResolvedValue([previous, year]);
  db.budgetPost.findMany.mockResolvedValue([post]);
  db.budgetAction.findMany.mockImplementation(async ({ where }) => where.post.fiscalYearId === "previous" ? [{ ...action().sourceAction, postId: post.id }] : [action()]);
  db.budgetSnapshot.findFirst.mockResolvedValue({ asOfDate: new Date("2026-10-25") });
  db.budgetSnapshot.findMany.mockResolvedValue([]);
  db.expense.findMany.mockResolvedValue([]);
  db.expense.groupBy.mockResolvedValue([]);
  db.expense.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: { _all: 0 } });
});
describe("lecture et export de la préparation", () => {
  it("choisit la première préparation puis l’année civile suivante", async () => {
    expect(await preparationYearLabel()).toBe("2027");
    expect(db.fiscalYear.findFirst).toHaveBeenCalledWith({ where: { phase: "PREPARATION" }, orderBy: { label: "asc" }, select: { label: true } });
    db.fiscalYear.findFirst.mockResolvedValue(null);
    expect(await preparationYearLabel()).toBe(String(new Date().getFullYear() + 1));
    expect(await preparationYearLabel("2028")).toBe("2028");
  });
  it("sérialise les montants et les références, calcule les deux constructions", async () => {
    const data = (await loadPreparation("2027"))!;
    expect(data.fiscalYear.targetFederation).toBe(240000);
    expect(data.lines[0]).toMatchObject({ team: "M20", proposedByName: "Entraîneur", revisedGross: 30500,
      source: { actualFederation: 13640, fiscalYearLabel: "2026" }, suggestion: { gross: 21700, federation: 10900, clubIncome: 10800 } });
    expect(data.previousYear).toMatchObject({ label: "2026", budget: 19500, actual: 13640 });
    expect(data.construction.retained.totals).toMatchObject({ federation: 19500, previousBudget: 19500, previousActual: 13640 });
    expect(data.construction.high.totals.federation).toBe(19500);
    expect(data.canOpen).toBe(false);
    expect(await loadPreparation("2028")).toBeNull();
  });
  it("propose l’ouverture seulement si les postes N-1 existent", async () => {
    db.budgetPost.findMany.mockImplementation(async ({ where }) => where.fiscalYearId === "previous" ? [post] : []);
    expect((await loadPreparation("2027"))?.canOpen).toBe(true);
    db.budgetPost.findMany.mockResolvedValue([]);
    expect((await loadPreparation("2027"))?.canOpen).toBe(false);
  });
  it("autorise la lecture et l’export à tout utilisateur connecté et retourne 404 si absent", async () => {
    const response = await get(new Request("http://localhost/api/budget-preparation?fiscalYear=2027"));
    expect(response.status).toBe(200); expect(authenticate.mock.lastCall).toHaveLength(1);
    expect((await get(new Request("http://localhost/api/budget-preparation?fiscalYear=2028"))).status).toBe(404);
    const exported = await exportBudget(new Request("http://localhost/api/budget-preparation/export?fiscalYear=2027"));
    expect(exported.status).toBe(200); expect(exported.headers.get("content-type")).toContain("spreadsheetml");
    expect(authenticate.mock.lastCall).toHaveLength(1);
    expect((await exportBudget(new Request("http://localhost/api/budget-preparation/export?fiscalYear=2028"))).status).toBe(404);
  });
  it("produit un classeur lisible avec sous-totaux, décisions et construction", async () => {
    const data = (await loadPreparation("2027"))!;
    const workbook = buildPreparationWorkbook(data);
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(restored.worksheets.map(sheet => sheet.name)).toEqual(["Budget 2027", "Construction"]);
    const sheet = restored.getWorksheet("Budget 2027")!;
    expect(sheet.getRow(2).getCell(8).value).toBe("Retenue");
    expect(sheet.getRow(2).getCell(11).value).toBe(19500);
    expect(sheet.getRow(2).getCell(17).value).toBe("Entraîneur");
    expect(sheet.getRow(3).getCell(11).value).toMatchObject({ formula: "SUM(K2:K2)", result: 19500 });
    expect(sheet.getRow(4).getCell(11).value).toMatchObject({ formula: "SUM(K3)", result: 19500 });
    expect(sheet.getRow(1).getCell(18).value).toBe("Saison");
    expect(sheet.getRow(2).getCell(18).value).toBe("26/27");
    const construction = restored.getWorksheet("Construction")!;
    expect(construction.getRow(2).getCell(7).value).toBe(19500);
    expect(construction.getRow(1).cellCount).toBe(12);
    expect(construction.getRow(1).getCell(10).value).toBe("Part FFE — Fin de saison 26/27 (janv.–août 2027)");
    expect([10, 11, 12].map(column => construction.getRow(2).getCell(column).value)).toEqual([19500, 0, 0]);
  });
  it("expose aussi la phase, la phrase et les références dans le pilotage", async () => {
    const data = (await loadPilotage("2027"))!;
    expect(data.fiscalYear.phase).toBe("PREPARATION");
    expect(data.actions[0].team).toBe("M20");
    expect(data.natures).toEqual([]);
    expect(data.headline).toContain("de budget FFE");
    expect(data.construction.posts[0].lines[0].previousActual).toBe(13640);
  });
  it("rapproche les notes par action et année civile sans changer les chiffres fédé", async () => {
    const baseline = (await loadPilotage("2027"))!;
    db.expense.groupBy.mockResolvedValue([{ budgetActionId: "new", _sum: { amount: decimal(1234.56) }, _count: { _all: 3 } }]);
    db.expense.aggregate.mockResolvedValue({ _sum: { amount: decimal(45.67) }, _count: { _all: 2 } });
    const data = (await loadPilotage("2027"))!;
    expect(db.expense.groupBy).toHaveBeenLastCalledWith({ by: ["budgetActionId"], where: { budgetAction: { post: { fiscalYearId: "fy" } } }, _sum: { amount: true }, _count: { _all: true } });
    expect(db.expense.aggregate).toHaveBeenLastCalledWith({ where: { budgetActionId: null, date: { gte: new Date("2027-01-01T00:00:00.000Z"), lt: new Date("2028-01-01T00:00:00.000Z") } }, _sum: { amount: true }, _count: { _all: true } });
    expect(data.actions[0].entered).toEqual({ amount: 1234.56, count: 3, notBooked: 1234.56 });
    expect(data.reconciliation).toEqual({ entered: 1234.56, count: 3, notBooked: 1234.56, unattached: { amount: 45.67, count: 2 } });
    const point = data.vigilance.find(item => item.message.includes("de notes de frais saisies"))!;
    expect(point).toMatchObject({ level: "info", actionId: "new", postCode: post.code });
    expect(data.reportText).toContain(point.message);
    expect(data.actions[0].figures).toEqual(baseline.actions[0].figures);
    expect(data.summary).toEqual(baseline.summary);
    expect(baseline.actions[0].entered).toEqual({ amount: 0, count: 0, notBooked: 0 });
  });
  it("regroupe les natures par nom et mois UTC dans les bornes de l’année civile", async () => {
    db.expense.findMany.mockResolvedValue([
      { amount: decimal(15.25), date: new Date("2027-09-02"), category: { name: "Transport" } },
      { amount: decimal(0.1), date: new Date("2027-03-01T00:30:00+01:00"), category: { name: "Repas" } },
      { amount: decimal(0.2), date: new Date("2027-02-15"), category: { name: "Repas" } },
      { amount: decimal(10), date: new Date("2027-01-02"), category: { name: "Transport" } },
    ]);
    db.budgetPost.findMany.mockResolvedValue([{ ...post, kind: "OPERATING" }]);
    db.budgetAction.findMany.mockImplementation(async ({ where }) => where.post.fiscalYearId === "previous" ? [] : [{ ...action(), fencingCategories: [] }]);
    const data = (await loadPilotage("2027"))!;
    expect(db.expense.findMany).toHaveBeenCalledWith({ where: { date: { gte: new Date("2027-01-01T00:00:00.000Z"), lt: new Date("2028-01-01T00:00:00.000Z") } },
      select: { amount: true, date: true, category: { select: { name: true } } } });
    expect(data.actions[0].team).toBe("COMMISSION");
    expect(data.natures).toEqual([{ name: "Repas", month: 2, amount: 0.3 }, { name: "Transport", month: 1, amount: 10 }, { name: "Transport", month: 9, amount: 15.25 }]);
  });
  it("donne à l’entraîneur le poids lecture seule", () => {
    expect(roleLabels.CONTRIBUTOR).toBe("Entraîneur (préparation du budget)");
    expect(hasMinimumRole("CONTRIBUTOR", "READONLY")).toBe(true);
    expect(hasMinimumRole("CONTRIBUTOR", "COMEH_MEMBER")).toBe(false);
  });
});
