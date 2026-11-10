import { describe, expect, it } from "vitest";
import { inferredSeasonLabel, seasonLabelsOf, seasonPartOf, seasonPartTitle, seasonYears } from "../budget-season";
import { inferredSeasonLabel as reexported } from "../budget-matrix-apply";

describe("saisons sportives et exercices", () => {
  it.each([[1, "26/27"], [8, "26/27"], [9, "27/28"], [12, "27/28"], [null, null]] as const)("rattache le mois %s de 2027 à la saison %s", (month, label) => {
    expect(inferredSeasonLabel("2027", month)).toBe(label);
    expect(reexported("2027", month)).toBe(label);
  });
  it("passe le changement de siècle", () => {
    expect(inferredSeasonLabel("2100", 1)).toBe("99/00");
    expect(inferredSeasonLabel("2100", 9)).toBe("00/01");
  });
  it.each([[1, "END"], [8, "END"], [9, "START"], [12, "START"], [null, "NONE"]] as const)("classe le mois %s en %s", (month, part) => {
    expect(seasonPartOf(month)).toBe(part);
  });
  it("donne les deux saisons d’un exercice", () => {
    expect(seasonLabelsOf("2027")).toEqual({ END: "26/27", START: "27/28" });
  });
  it("retrouve les deux exercices d’une saison", () => {
    expect(seasonYears("27/28")).toEqual({ startYear: 2027, endYear: 2028 });
    expect(seasonYears("99/00")).toEqual({ startYear: 2099, endYear: 2100 });
  });
  it.each(["27/29", "2027", "27-28", "", "27/28 ", "7/8"])("refuse le libellé %j", label => {
    expect(seasonYears(label)).toBeNull();
  });
  it("nomme les parts de saison", () => {
    expect(seasonPartTitle("END", "2027")).toBe("Fin de saison 26/27 (janv.–août 2027)");
    expect(seasonPartTitle("START", "2027")).toBe("Début de saison 27/28 (sept.–déc. 2027)");
    expect(seasonPartTitle("NONE", "2027")).toBe("Sans mois (année entière ou à préciser)");
  });
});
