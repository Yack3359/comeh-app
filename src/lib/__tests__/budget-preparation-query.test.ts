import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { pilotageAction, post } from "./budget-fixtures";

const db = vi.hoisted(() => ({ fiscalYear: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
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
    expect(restored.getWorksheet("Construction")!.getRow(2).getCell(7).value).toBe(19500);
  });
  it("expose aussi la phase, la phrase et les références dans le pilotage", async () => {
    const data = (await loadPilotage("2027"))!;
    expect(data.fiscalYear.phase).toBe("PREPARATION");
    expect(data.headline).toContain("de budget FFE");
    expect(data.construction.posts[0].lines[0].previousActual).toBe(13640);
  });
  it("donne à l’entraîneur le poids lecture seule", () => {
    expect(roleLabels.CONTRIBUTOR).toBe("Entraîneur (préparation du budget)");
    expect(hasMinimumRole("CONTRIBUTOR", "READONLY")).toBe(true);
    expect(hasMinimumRole("CONTRIBUTOR", "COMEH_MEMBER")).toBe(false);
  });
});
