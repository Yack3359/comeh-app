/**
 * Complète les prénoms des athlètes importés par import-bilan-m17.ts.
 *
 * Sources :
 * - 17 prénoms retrouvés directement dans les autres fichiers "Feuille de
 *   Route" déjà fournis par la COMEH (FDR VIERGE / FDR COPENHAGUE / FDR
 *   GRENOBLE), avec club et pôle en bonus quand disponibles.
 * - 13 prénoms retrouvés via le site officiel FFEscrime (classements
 *   nationaux publics) et recherche web.
 * - 3 noms (Remy, Barre, Commissaire) restent non résolus : trop ambigus /
 *   aucune correspondance fiable trouvée. Laissés en l'état, à vérifier par
 *   la COMEH en interne.
 *
 * Exécution : npx tsx scripts/update-m17-first-names.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEHOLDER_FIRST_NAME = "(prénom à compléter)";

type Update = {
  lastName: string;
  firstName: string;
  club?: string;
  pole?: string;
  correctedLastName?: string;
};

const updates: Update[] = [
  // Retrouvés dans les Feuilles de Route déjà fournies (Copenhague 24/25,
  // Copenhague 25/26, Grenoble 25/26).
  { lastName: "Toto", firstName: "Hiroaki", club: "Pau Section", pole: "PFR Reims" },
  { lastName: "Leblanc-Morel", firstName: "Lucien", club: "Arras CE", pole: "CFF Douai" },
  { lastName: "Chapoulie", firstName: "Loan", club: "Sarlat CE", pole: "PFR Reims" },
  { lastName: "Le May", firstName: "Alban", club: "Chartres CEA" },
  { lastName: "Hays", firstName: "Kezia", club: "Lorient SE" },
  { lastName: "Cuadrado", firstName: "Thomas", club: "Bourg Andeol" },
  { lastName: "Sorensen", firstName: "Jacques", club: "Levallois" },
  { lastName: "Roul", firstName: "Noam", club: "Ja St Malo" },
  { lastName: "Bonnafe", firstName: "Tom", club: "Rodez Aveyron", pole: "CFF Rodez" },
  { lastName: "Gravel", firstName: "Gabriel", club: "Orsay Ca" },
  { lastName: "Lamouroux", firstName: "Lucas", club: "Nimes Se" },
  { lastName: "Millot-Tristram", firstName: "Tiago", club: "Bruay Uso" },
  { lastName: "Etonde-Bebey", firstName: "Lelio", club: "Angers Sco" },
  { lastName: "Le Treut", firstName: "Louis", club: "St Gratien", pole: "PFR Reims" },
  { lastName: "Leger", firstName: "Jules", club: "Le Havre Ce" },
  { lastName: "Gauliard", firstName: "Thomas", club: "Bourg Andeol", pole: "CFF Lyon" },
  { lastName: "Lelong", firstName: "Charlie", club: "Valenciennes" },

  // Retrouvés via le site FFEscrime (classements publics) / recherche web.
  { lastName: "Rahamefy", firstName: "Aina", club: "Ce Saint Gratien" },
  {
    lastName: "Lesponne Denis",
    correctedLastName: "Lesponne-Denis",
    firstName: "Mattéo",
    club: "Cie Tourcoing",
  },
  { lastName: "Delevacque", firstName: "Maxime", club: "Passavant-La-Rochere" },
  { lastName: "Mitrail", firstName: "Theo", club: "Se Nimes" },
  { lastName: "Duchene", firstName: "Noam", club: "Se Nimes" },
  { lastName: "Lebel", firstName: "Sacha" },
  { lastName: "Imbert", firstName: "Etienne" },
  { lastName: "Moulin", firstName: "Liam" },
  { lastName: "Ambrosini", firstName: "Alessio" },
  { lastName: "Noel", firstName: "Sebastien" },
  { lastName: "Tan", firstName: "Lucas" },
  { lastName: "Astrella", firstName: "Niklas", club: "Levallois" },
  { lastName: "Gawlas", firstName: "William" },
];

async function main() {
  let updated = 0;
  let notFound: string[] = [];

  for (const entry of updates) {
    const athlete = await prisma.athlete.findFirst({
      where: { lastName: entry.lastName, firstName: PLACEHOLDER_FIRST_NAME },
      select: { id: true },
    });

    if (!athlete) {
      notFound.push(entry.lastName);
      continue;
    }

    await prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        firstName: entry.firstName,
        lastName: entry.correctedLastName ?? entry.lastName,
        ...(entry.club ? { club: entry.club } : {}),
        ...(entry.pole ? { pole: entry.pole } : {}),
      },
    });
    updated += 1;
  }

  const stillPlaceholder = await prisma.athlete.findMany({
    where: { firstName: PLACEHOLDER_FIRST_NAME },
    select: { lastName: true },
  });

  console.info(`${updated} athlètes mis à jour avec leur vrai prénom.`);
  if (notFound.length > 0) {
    console.info(`Non trouvés en base (déjà à jour ou nom différent) : ${notFound.join(", ")}`);
  }
  console.info(
    `Restent avec prénom placeholder (non résolus) : ${stillPlaceholder.map((a) => a.lastName).join(", ")}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
