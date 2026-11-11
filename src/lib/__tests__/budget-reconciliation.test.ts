import { describe, expect, it } from "vitest";
import { buildReconciliation, listReconciliationPoints, reconcileAction } from "../budget-reconciliation";

describe("rapprochement d’une action", () => {
  it("retourne zéro sans note, même avec un brut négatif", () => {
    expect(reconcileAction({ actualGross: null })).toEqual({ amount: 0, count: 0, notBooked: 0 });
    expect(reconcileAction({ actualGross: -10 }, { amount: 0, count: 0 })).toEqual({ amount: 0, count: 0, notBooked: 0 });
  });
  it("compte tout le saisi quand le brut n’est pas renseigné", () => {
    expect(reconcileAction({ actualGross: null }, { amount: 100, count: 2 })).toEqual({ amount: 100, count: 2, notBooked: 100 });
  });
  it.each([150, 100])("ne signale rien quand le brut %s couvre le saisi", actualGross => {
    expect(reconcileAction({ actualGross }, { amount: 100, count: 2 }).notBooked).toBe(0);
  });
  it("compare le saisi au brut et arrondit au centime", () => {
    expect(reconcileAction({ actualGross: 50 }, { amount: 100, count: 2 })).toEqual({ amount: 100, count: 2, notBooked: 50 });
    expect(reconcileAction({ actualGross: 1.004 }, { amount: 2.01, count: 1 }).notBooked).toBe(1.01);
  });
});
describe("synthèse du rapprochement", () => {
  it("additionne les montants arrondis et garde les notes sans action à part", () => {
    const actions = [{ entered: { amount: 0.1, count: 1, notBooked: 0.1 } }, { entered: { amount: 0.2, count: 2, notBooked: 0.2 } }];
    expect(buildReconciliation(actions, { amount: 12.345, count: 3 })).toEqual({ entered: 0.3, count: 3, notBooked: 0.3, unattached: { amount: 12.35, count: 3 } });
    expect(buildReconciliation([], { amount: 0, count: 0 })).toEqual({ entered: 0, count: 0, notBooked: 0, unattached: { amount: 0, count: 0 } });
  });
});
const action = (notBooked: number, status = "BUDGETED", isSettled = false) => ({ id: "a", label: "Doha GP", postCode: "C", status, isSettled,
  entered: { amount: notBooked, count: 1, notBooked } });
describe("points de vigilance du rapprochement", () => {
  it("applique strictement le seuil de 0,5 euro", () => {
    expect(listReconciliationPoints([action(0), action(0.49), action(0.5)])).toEqual([]);
    expect(listReconciliationPoints([action(0.51)])).toHaveLength(1);
  });
  it("informe sans changer l’atterrissage pour une action encore ouverte", () => {
    expect(listReconciliationPoints([action(1234.56)])).toEqual([{ level: "info", actionId: "a", postCode: "C",
      message: "Doha GP : 1 234,56 € de notes de frais saisies ne figurent pas encore dans le réalisé fédé" }]);
    expect(listReconciliationPoints([action(10, "DONE")])[0].level).toBe("info");
  });
  it.each([["DONE", true], ["BUDGETED", true], ["CANCELLED", false]] as const)("alerte en orange pour %s, soldée %s", (status, isSettled) => {
    expect(listReconciliationPoints([action(10, status, isSettled)])).toEqual([{ level: "orange", actionId: "a", postCode: "C",
      message: "Doha GP : 10 € de notes de frais saisies ne figurent pas encore dans le réalisé fédé — l’atterrissage est probablement sous-estimé" }]);
  });
});
