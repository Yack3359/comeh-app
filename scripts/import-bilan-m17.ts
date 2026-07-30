/**
 * Import ponctuel des bilans de médailles M17 (saisons 22/23 à 25/26),
 * transcrits depuis "Bilan Saisons EH M17_.xlsx" fourni par la COMEH.
 *
 * Approximations assumées et validées avec l'utilisateur avant import :
 * - Prénom des athlètes inconnu (fichier source ne donne que le nom de famille)
 *   -> firstName = "(prénom à compléter)"
 * - Date exacte des compétitions inconnue (fichier source ne donne que la saison)
 *   -> date = 1er du mois estimé à partir du calendrier EFC/FIE habituel,
 *      avec la mention "(date approximative)" dans chaque description de résultat.
 *
 * Rang individuel : Or=1, Argent=2, Bronze=3 (podium réel).
 * Pour T8/T16/T32, le rang exact n'est pas connu, seul le tour d'élimination
 * l'est : on stocke le rang plafond du tableau (8/16/32) et le tour réel
 * dans `round` pour ne pas laisser croire à une précision qu'on n'a pas.
 *
 * Rang équipe : "X" dans une colonne Or/Argent/Bronze = médaille réellement
 * obtenue (podium), un nombre ("6e", "9e"...) = classement exact connu.
 *
 * Exécution : npx tsx scripts/import-bilan-m17.ts
 */
import { PrismaClient, Gender, Weapon, FencingCategory } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEHOLDER_FIRST_NAME = "(prénom à compléter)";
const APPROX_NOTE = "(date approximative)";

type SeasonKey = "22/23" | "23/24" | "24/25" | "25/26";

const seasonDefs: Record<
  SeasonKey,
  { label: string; startDate: string; endDate: string; fiscalYears: [string, string] }
> = {
  "22/23": {
    label: "22/23",
    startDate: "2022-09-01",
    endDate: "2023-07-31",
    fiscalYears: ["2022", "2023"],
  },
  "23/24": {
    label: "23/24",
    startDate: "2023-09-01",
    endDate: "2024-07-31",
    fiscalYears: ["2023", "2024"],
  },
  "24/25": {
    label: "24/25",
    startDate: "2024-09-01",
    endDate: "2025-07-31",
    fiscalYears: ["2024", "2025"],
  },
  "25/26": {
    label: "25/26",
    startDate: "2025-09-01",
    endDate: "2026-07-31",
    fiscalYears: ["2025", "2026"],
  },
};

// Mois estimé (1-12) et pays pour chaque compétition récurrente, basé sur le
// calendrier EFC/FIE habituel de la catégorie M17 (à ajuster si les dates
// réelles sont retrouvées).
const competitionMeta: Record<
  string,
  { country: string; level: string; month: number; secondYear: boolean }
> = {
  KLAGENFURT: { country: "Autriche", level: "EFC", month: 10, secondYear: false },
  GRENOBLE: { country: "France", level: "EFC", month: 11, secondYear: false },
  LEIPZIG: { country: "Allemagne", level: "EFC", month: 11, secondYear: false },
  COPENHAGUE: { country: "Danemark", level: "EFC", month: 12, secondYear: false },
  BRATISLAVA: { country: "Slovaquie", level: "EFC", month: 1, secondYear: true },
  CRACOVIE: { country: "Pologne", level: "EFC", month: 2, secondYear: true },
  EUROPE: {
    country: "À déterminer",
    level: "Championnat d'Europe cadets/juniors",
    month: 2,
    secondYear: true,
  },
  MONDE: {
    country: "À déterminer",
    level: "Championnat du monde cadets/juniors",
    month: 4,
    secondYear: true,
  },
};

function competitionDate(season: SeasonKey, name: string): Date {
  const meta = competitionMeta[name];
  const [y1] = season.split("/").map((part) => 2000 + Number(part));
  const year = meta.secondYear ? y1 + 1 : y1;
  return new Date(Date.UTC(year, meta.month - 1, 1));
}

type IndividualRow = {
  competition: string;
  or?: string[];
  argent?: string[];
  bronze?: string[];
  t8?: string[];
  t16?: string[];
  t32?: string[];
};

type TeamRow = {
  competition: string;
  rank: number;
  label: string;
};

type SeasonData = {
  individual: IndividualRow[];
  team: TeamRow[];
};

const data: Record<SeasonKey, SeasonData> = {
  "22/23": {
    individual: [
      {
        competition: "KLAGENFURT",
        argent: ["RAHAMEFY"],
        t16: ["MITRAIL"],
        t32: ["LEBEL", "LESPONNE DENIS", "COMMISSAIRE", "DUCHENE"],
      },
      {
        competition: "GRENOBLE",
        bronze: ["DUCHENE"],
        t8: ["LESPONNE DENIS"],
        t16: ["RAHAMEFY"],
        t32: ["REMY", "MITRAIL"],
      },
      {
        competition: "LEIPZIG",
        t8: ["RAHAMEFY"],
        t16: ["LEBEL"],
        t32: ["LE TREUT"],
      },
      {
        competition: "BRATISLAVA",
        argent: ["DUCHENE"],
        t16: ["LESPONNE DENIS"],
        t32: ["RAHAMEFY", "BARRE", "LEBEL"],
      },
      {
        competition: "CRACOVIE",
        argent: ["MITRAIL"],
        t32: ["GAWLAS"],
      },
      {
        competition: "EUROPE",
        t8: ["DUCHENE"],
        t32: ["RAHAMEFY"],
      },
      {
        competition: "MONDE",
        bronze: ["DUCHENE"],
      },
    ],
    team: [
      { competition: "GRENOBLE", rank: 6, label: "6e" },
      { competition: "LEIPZIG", rank: 9, label: "9e" },
      { competition: "BRATISLAVA", rank: 2, label: "Argent (X)" },
      { competition: "EUROPE", rank: 6, label: "6e" },
    ],
  },
  "23/24": {
    individual: [
      {
        competition: "GRENOBLE",
        bronze: ["IMBERT"],
        t8: ["DUCHENE"],
        t16: ["MOULIN", "AMBROSINI"],
        t32: ["CUADRADO", "LEBEL"],
      },
      {
        competition: "COPENHAGUE",
        bronze: ["DUCHENE"],
        t16: ["AMBROSINI", "TAN", "IMBERT"],
        t32: ["NOEL", "LE TREUT", "ASTRELLA"],
      },
      {
        competition: "BRATISLAVA",
        t8: ["MITRAIL"],
        t16: ["ASTRELLA", "DELEVACQUE", "NOEL"],
      },
      {
        competition: "CRACOVIE",
        t8: ["DELEVACQUE", "LEGER"],
        t16: ["ASTRELLA"],
        t32: ["DUCHENE", "GAULIARD", "TOTO"],
      },
      {
        competition: "EUROPE",
        bronze: ["MITRAIL"],
        t8: ["ASTRELLA"],
        t16: ["DUCHENE"],
      },
      {
        competition: "MONDE",
        t8: ["DUCHENE"],
        t32: ["MITRAIL"],
      },
    ],
    team: [
      { competition: "GRENOBLE", rank: 4, label: "4e" },
      { competition: "COPENHAGUE", rank: 7, label: "7e" },
      { competition: "BRATISLAVA", rank: 12, label: "12e" },
      { competition: "CRACOVIE", rank: 4, label: "4e" },
      { competition: "EUROPE", rank: 11, label: "11e" },
    ],
  },
  "24/25": {
    individual: [
      {
        competition: "GRENOBLE",
        t32: ["LE TREUT", "LEGER", "CUADRADO", "TOTO", "LELONG", "LEBLANC-MOREL"],
      },
      {
        competition: "COPENHAGUE",
        argent: ["GAULIARD"],
        t8: ["MILLOT-TRISTRAM", "CHAPOULIE"],
        t16: ["ETONDE-BEBEY"],
        t32: ["LEGER"],
      },
      {
        competition: "BRATISLAVA",
        t16: ["GAULIARD"],
      },
      {
        competition: "CRACOVIE",
        t16: ["LEBLANC-MOREL", "TOTO"],
        t32: ["CUADRADO"],
      },
      {
        competition: "EUROPE",
        t16: ["GAULIARD"],
        t32: ["MILLOT-TRISTRAM"],
      },
      {
        competition: "MONDE",
        t8: ["GAULIARD"],
      },
    ],
    team: [
      { competition: "GRENOBLE", rank: 3, label: "Bronze (X)" },
      { competition: "COPENHAGUE", rank: 1, label: "Or (X)" },
      { competition: "BRATISLAVA", rank: 9, label: "9e" },
      { competition: "CRACOVIE", rank: 1, label: "Or (X)" },
      { competition: "EUROPE", rank: 14, label: "14e" },
    ],
  },
  "25/26": {
    individual: [
      {
        competition: "GRENOBLE",
        argent: ["LEBLANC MOREL"],
        bronze: ["TOTO"],
        t16: ["LE MAY", "HAYS"],
        t32: ["SORENSEN", "CHAPOULIE", "LAMOUROUX", "CUADRADO", "ROUL"],
      },
      {
        competition: "COPENHAGUE",
        t8: ["LE MAY", "CUADRADO"],
        t32: ["LAMOUROUX", "CHAPOULIE", "BONNAFE"],
      },
      {
        competition: "BRATISLAVA",
        bronze: ["TOTO"],
        t16: ["ROUL"],
        t32: ["LAMOUROUX", "GRAVEL"],
      },
      {
        competition: "CRACOVIE",
        t8: ["TOTO"],
        t16: ["CHAPOULIE"],
      },
      {
        competition: "EUROPE",
        or: ["TOTO"],
        t16: ["LE MAY"],
      },
      {
        competition: "MONDE",
        or: ["TOTO"],
        t32: ["LE MAY"],
      },
    ],
    team: [
      { competition: "GRENOBLE", rank: 2, label: "Argent (X)" },
      { competition: "COPENHAGUE", rank: 1, label: "Or (X)" },
      { competition: "BRATISLAVA", rank: 8, label: "8ème" },
      { competition: "CRACOVIE", rank: 4, label: "4ème" },
      { competition: "EUROPE", rank: 1, label: "Or (X)" },
    ],
  },
};

function normalizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^LEBLANC MOREL$/i, "LEBLANC-MOREL");
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/([ -])/)
    .map((part) => (part === " " || part === "-" ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

async function main() {
  const athleteCache = new Map<string, string>();

  async function getOrCreateAthlete(rawName: string) {
    const name = normalizeName(rawName);
    if (athleteCache.has(name)) {
      return athleteCache.get(name)!;
    }

    const lastName = toTitleCase(name);
    const existing = await prisma.athlete.findFirst({
      where: { lastName, firstName: PLACEHOLDER_FIRST_NAME },
      select: { id: true },
    });

    const athlete =
      existing ??
      (await prisma.athlete.create({
        data: {
          firstName: PLACEHOLDER_FIRST_NAME,
          lastName,
          gender: Gender.MALE,
          country: "France",
        },
        select: { id: true },
      }));

    athleteCache.set(name, athlete.id);
    return athlete.id;
  }

  for (const seasonKey of Object.keys(data) as SeasonKey[]) {
    const def = seasonDefs[seasonKey];
    const fiscalYearRecords = await Promise.all(
      def.fiscalYears.map((label) =>
        prisma.fiscalYear.upsert({
          where: { label },
          update: {},
          create: {
            label,
            startDate: new Date(`${label}-01-01T00:00:00.000Z`),
            endDate: new Date(`${label}-12-31T00:00:00.000Z`),
          },
        }),
      ),
    );

    const season = await prisma.season.upsert({
      where: { label: def.label },
      update: {},
      create: {
        label: def.label,
        startDate: new Date(`${def.startDate}T00:00:00.000Z`),
        endDate: new Date(`${def.endDate}T00:00:00.000Z`),
        fiscalYears: { connect: fiscalYearRecords.map(({ id }) => ({ id })) },
      },
      select: { id: true },
    });

    console.info(`Saison ${def.label} prête (${season.id})`);

    const team = await prisma.team.upsert({
      where: { seasonId_name: { seasonId: season.id, name: "Équipe de France M17" } },
      update: {},
      create: { seasonId: season.id, name: "Équipe de France M17" },
      select: { id: true },
    });

    const seasonData = data[seasonKey];
    const competitionIds = new Map<string, string>();

    const allCompetitionNames = new Set([
      ...seasonData.individual.map((row) => row.competition),
      ...seasonData.team.map((row) => row.competition),
    ]);

    for (const name of allCompetitionNames) {
      const meta = competitionMeta[name];
      const date = competitionDate(seasonKey, name);
      const displayName = `${name.charAt(0)}${name.slice(1).toLowerCase()} (EH M17, ${def.label})`;

      const existing = await prisma.competition.findFirst({
        where: { seasonId: season.id, name: displayName },
        select: { id: true },
      });

      const competition =
        existing ??
        (await prisma.competition.create({
          data: {
            name: displayName,
            location: toTitleCase(name),
            country: meta.country,
            date,
            seasonId: season.id,
            level: meta.level,
            weapon: Weapon.EPEE,
            gender: Gender.MALE,
            category: FencingCategory.M17,
          },
          select: { id: true },
        }));

      competitionIds.set(name, competition.id);
    }

    let individualResultsCreated = 0;
    for (const row of seasonData.individual) {
      const competitionId = competitionIds.get(row.competition)!;
      const tiers: Array<[keyof IndividualRow, number, string]> = [
        ["or", 1, "Finale (Or)"],
        ["argent", 2, "Finale (Argent)"],
        ["bronze", 3, "Finale (Bronze)"],
        ["t8", 8, "Tableau de 8"],
        ["t16", 16, "Tableau de 16"],
        ["t32", 32, "Tableau de 32"],
      ];

      for (const [key, rank, roundLabel] of tiers) {
        const names = row[key] as string[] | undefined;
        if (!names) continue;

        for (const rawName of names) {
          const athleteId = await getOrCreateAthlete(rawName);

          const alreadyExists = await prisma.result.findFirst({
            where: { competitionId, athleteId, rank },
            select: { id: true },
          });
          if (alreadyExists) continue;

          await prisma.result.create({
            data: {
              competitionId,
              athleteId,
              rank,
              round: `${roundLabel} ${APPROX_NOTE}`,
            },
          });
          individualResultsCreated += 1;
        }
      }
    }

    let teamResultsCreated = 0;
    for (const row of seasonData.team) {
      const competitionId = competitionIds.get(row.competition)!;
      const alreadyExists = await prisma.result.findFirst({
        where: { competitionId, teamId: team.id },
        select: { id: true },
      });
      if (alreadyExists) continue;

      await prisma.result.create({
        data: {
          competitionId,
          teamId: team.id,
          rank: row.rank,
          round: `Classement équipe ${row.label} ${APPROX_NOTE}`,
        },
      });
      teamResultsCreated += 1;
    }

    console.info(
      `  ${allCompetitionNames.size} compétitions, ${individualResultsCreated} résultats individuels, ${teamResultsCreated} résultats équipe créés`,
    );

    for (const rawName of new Set(
      seasonData.individual.flatMap((row) =>
        [...(row.or ?? []), ...(row.argent ?? []), ...(row.bronze ?? []), ...(row.t8 ?? []), ...(row.t16 ?? []), ...(row.t32 ?? [])],
      ),
    )) {
      const athleteId = await getOrCreateAthlete(rawName);
      await prisma.athleteCategorySeason.upsert({
        where: { athleteId_seasonId: { athleteId, seasonId: season.id } },
        update: { category: FencingCategory.M17 },
        create: { athleteId, seasonId: season.id, category: FencingCategory.M17 },
      });
    }
  }

  console.info(`\nTotal athlètes créés/réutilisés : ${athleteCache.size}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
