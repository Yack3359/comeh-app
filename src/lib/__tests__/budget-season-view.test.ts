import { describe, expect, it } from "vitest";
import type { PreparationLine } from "../budget-preparation";
import { buildSeasonView, type SeasonYearInput } from "../budget-season-view";
import { pilotageAction, post } from "./budget-fixtures";

const line = (overrides: Partial<PreparationLine> = {}): PreparationLine => ({ ...pilotageAction(), postId: post.id,
  fencingCategories: ["M17"], proposalStatus: "PROPOSED", amountsConfirmed: false, postKind: "TRAINING_CAMP", ...overrides });
const nextPost = { ...post, id: "post-b-2028", label: "Stages séniors 2028" };
const start: SeasonYearInput = { label: "2027", phase: "EXECUTION", posts: [post], lines: [
  line({ id: "h", plannedMonth: 12 }), line({ id: "a", plannedMonth: 10, actualFederation: 30 }),
  line({ id: "b", plannedMonth: 11, status: "OPTION", includedInBudget: false, actualFederation: 5 }),
  line({ id: "c", plannedMonth: 3 }), line({ id: "d" })] };
const end: SeasonYearInput = { label: "2028", phase: "PREPARATION", posts: [nextPost], lines: [
  line({ id: "f", postId: nextPost.id, plannedMonth: 5, revisedFederation: 20 }),
  line({ id: "e", postId: nextPost.id, plannedMonth: 2, proposalStatus: "VALIDATED", revisedFederation: 60 }),
  line({ id: "g", postId: nextPost.id })] };
describe("vue d’une saison sportive", () => {
  it("réunit le début voté et la fin en préparation", () => {
    const view = buildSeasonView("27/28", { start, end }, { includePending: false });
    expect(view.season).toBe("27/28");
    expect(view.parts).toEqual({ START: { fiscalYearLabel: "2027", state: "EXECUTION", period: "sept.–déc. 2027" },
      END: { fiscalYearLabel: "2028", state: "PREPARATION", period: "janv.–août 2028" } });
    expect(view.totals.START).toEqual({ gross: 300, clubIncome: 100, federation: 200, actual: 35, count: 2 });
    expect(view.totals.END).toMatchObject({ federation: 60, count: 1 });
    expect(view.totals.total).toMatchObject({ federation: 260, actual: 35, count: 3 });
    expect(view.undated).toEqual([{ fiscalYearLabel: "2027", count: 1, federation: 100 }, { fiscalYearLabel: "2028", count: 0, federation: 0 }]);
  });
  it("ajoute les lignes pas encore retenues dans l’hypothèse haute, sans toucher au budget voté", () => {
    const view = buildSeasonView("27/28", { start, end }, { includePending: true });
    expect(view.totals.START).toMatchObject({ federation: 200, count: 2 });
    expect(view.totals.END).toMatchObject({ federation: 80, count: 2 });
    expect(view.undated[1]).toEqual({ fiscalYearLabel: "2028", count: 1, federation: 100 });
  });
  it("fusionne les postes par code et range les lignes dans l’ordre de la saison", () => {
    const view = buildSeasonView("27/28", { start, end }, { includePending: true });
    expect(view.posts).toHaveLength(1);
    expect(view.posts[0]).toMatchObject({ code: "B", label: "Stages séniors 2028", kind: "TRAINING_CAMP", total: { federation: 280, count: 4 } });
    expect(view.posts[0].lines.map(item => item.id)).toEqual(["a", "h", "e", "f"]);
    expect(view.posts[0].lines[0]).toMatchObject({ part: "START", fiscalYearLabel: "2027", plannedMonth: 10, team: "M17", federation: 100, actualFederation: 30 });
    expect(view.posts[0].lines[2]).toMatchObject({ part: "END", fiscalYearLabel: "2028", decision: "VALIDATED" });
  });
  it("répartit la saison par équipe", () => {
    const view = buildSeasonView("27/28", { start, end }, { includePending: false });
    expect(view.teams.map(item => item.team)).toEqual(["SENIORS", "M20", "M17", "COMMUN", "COMMISSION"]);
    expect(view.teams.find(item => item.team === "M17")).toMatchObject({ START: { federation: 200 }, END: { federation: 60 }, total: { federation: 260 } });
    expect(view.teams.find(item => item.team === "SENIORS")?.total).toEqual({ gross: 0, clubIncome: 0, federation: 0, actual: 0, count: 0 });
  });
  it("signale un exercice pas encore ouvert", () => {
    const view = buildSeasonView("27/28", { start, end: null }, { includePending: false });
    expect(view.parts.END).toEqual({ fiscalYearLabel: "2028", state: "MISSING", period: "janv.–août 2028" });
    expect(view.totals.END).toEqual({ gross: 0, clubIncome: 0, federation: 0, actual: 0, count: 0 });
    expect(view.totals.total.federation).toBe(200);
    expect(view.posts[0].label).toBe("Stages séniors");
    expect(view.undated).toHaveLength(1);
    expect(buildSeasonView("27/28", { start: null, end: null }, { includePending: true })).toMatchObject({ posts: [], undated: [], totals: { total: { count: 0 } } });
  });
  it("refuse un libellé de saison invalide", () => {
    expect(() => buildSeasonView("2027", { start, end }, { includePending: false })).toThrow("Saison invalide");
  });
});
