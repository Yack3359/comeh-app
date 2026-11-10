import { beforeEach, describe, expect, it, vi } from "vitest";
import { pilotageAction, post } from "./budget-fixtures";

const db = vi.hoisted(() => ({ fiscalYear: { findUnique: vi.fn() }, budgetPost: { findMany: vi.fn() }, budgetAction: { findMany: vi.fn() } }));
const authenticate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({ runAsAuthenticatedUser: authenticate }));
import { GET } from "@/app/api/budget-season/route";

const year = { id: "fy", label: "2027", phase: "PREPARATION" };
const row = (overrides: object = {}) => ({ ...pilotageAction(), postId: post.id, fencingCategories: ["M20"], proposalStatus: "VALIDATED", amountsConfirmed: true,
  initialGross: 0, initialClubIncome: 0, previousYearAmount: null, post: { kind: post.kind }, ...overrides });
const get = (season: string) => GET(new Request("http://localhost/api/budget-season?season=" + encodeURIComponent(season)));
beforeEach(() => {
  vi.resetAllMocks();
  authenticate.mockImplementation((operation: (id: string) => Promise<unknown>) => operation("reader"));
  db.fiscalYear.findUnique.mockImplementation(async ({ where }) => where.label === "2027" ? year : null);
  db.budgetPost.findMany.mockResolvedValue([post]);
  db.budgetAction.findMany.mockResolvedValue([row({ id: "octobre", plannedMonth: 10 }), row({ id: "mars", plannedMonth: 3 }),
    row({ id: "option", plannedMonth: 11, proposalStatus: "PROPOSED" })]);
});
describe("route de lecture d’une saison", () => {
  it.each(["2027", "27/29", ""])("refuse la saison %j sans lire la base", async season => {
    const response = await get(season);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Saison invalide" });
    expect(authenticate).not.toHaveBeenCalled();
    expect(db.fiscalYear.findUnique).not.toHaveBeenCalled();
  });
  it("lit la saison à cheval sur un exercice ouvert et un exercice absent", async () => {
    const response = await get("27/28");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(authenticate.mock.lastCall).toHaveLength(1);
    expect(db.fiscalYear.findUnique.mock.calls.map(([argument]) => argument.where.label).sort()).toEqual(["2027", "2028"]);
    expect(db.budgetAction.findMany).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body.retained.parts).toMatchObject({ START: { fiscalYearLabel: "2027", state: "PREPARATION" }, END: { fiscalYearLabel: "2028", state: "MISSING" } });
    expect(body.retained.totals.START).toMatchObject({ count: 1, federation: 100 });
    expect(body.high.totals.START.count).toBe(2);
    expect(body.retained.posts[0].lines.map((item: { id: string }) => item.id)).toEqual(["octobre"]);
  });
  it("lit la fin de saison dans le même exercice", async () => {
    const body = await (await get("26/27")).json();
    expect(body.retained.parts).toMatchObject({ START: { state: "MISSING" }, END: { fiscalYearLabel: "2027", state: "PREPARATION" } });
    expect(body.retained.totals.END).toMatchObject({ count: 1, federation: 100 });
  });
});
