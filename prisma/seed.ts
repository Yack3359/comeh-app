import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

type FiscalYearSeed = {
  label: string;
  startDate: Date;
  endDate: Date;
};

type SeasonSeed = {
  label: string;
  startDate: Date;
  endDate: Date;
  fiscalYears: FiscalYearSeed[];
};

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

const seasons: SeasonSeed[] = [
  {
    label: "23/24",
    startDate: date("2023-09-01"),
    endDate: date("2024-07-31"),
    fiscalYears: [
      { label: "2023", startDate: date("2023-01-01"), endDate: date("2023-12-31") },
      { label: "2024", startDate: date("2024-01-01"), endDate: date("2024-12-31") },
    ],
  },
  {
    label: "24/25",
    startDate: date("2024-09-01"),
    endDate: date("2025-07-31"),
    fiscalYears: [
      { label: "2024", startDate: date("2024-01-01"), endDate: date("2024-12-31") },
      { label: "2025", startDate: date("2025-01-01"), endDate: date("2025-12-31") },
    ],
  },
  {
    label: "25/26",
    startDate: date("2025-09-01"),
    endDate: date("2026-07-31"),
    fiscalYears: [
      { label: "2025", startDate: date("2025-01-01"), endDate: date("2025-12-31") },
      { label: "2026", startDate: date("2026-01-01"), endDate: date("2026-12-31") },
    ],
  },
];

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@comeh.local").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "change-this-password";
  const name = process.env.ADMIN_NAME ?? "Administrateur COMEH";

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD doit contenir au moins 12 caractères.");
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: Role.ADMIN,
    },
    create: {
      email,
      name,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.info(`Compte administrateur prêt : ${email}`);
}

async function seedSeasons() {
  for (const season of seasons) {
    const fiscalYearRecords = await Promise.all(
      season.fiscalYears.map((fiscalYear) =>
        prisma.fiscalYear.upsert({
          where: { label: fiscalYear.label },
          update: {
            startDate: fiscalYear.startDate,
            endDate: fiscalYear.endDate,
          },
          create: fiscalYear,
        }),
      ),
    );

    await prisma.season.upsert({
      where: { label: season.label },
      update: {
        startDate: season.startDate,
        endDate: season.endDate,
        fiscalYears: {
          set: fiscalYearRecords.map(({ id }) => ({ id })),
        },
      },
      create: {
        label: season.label,
        startDate: season.startDate,
        endDate: season.endDate,
        fiscalYears: {
          connect: fiscalYearRecords.map(({ id }) => ({ id })),
        },
      },
    });
  }

  console.info(`Saisons prêtes : ${seasons.map(({ label }) => label).join(", ")}`);
}

async function main() {
  await seedAdmin();
  await seedSeasons();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
