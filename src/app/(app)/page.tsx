import { CalendarRange, Database, Fingerprint, ShieldCheck } from "lucide-react";

const foundations = [
  {
    title: "Authentification",
    description: "Sessions signées, mots de passe bcrypt et trois niveaux de rôle.",
    icon: Fingerprint,
  },
  {
    title: "Traçabilité",
    description: "Chaque mutation API authentifiée alimente automatiquement le journal d’audit.",
    icon: ShieldCheck,
  },
  {
    title: "Données structurées",
    description: "Le schéma PostgreSQL est prêt pour les modules Frais et Rankings.",
    icon: Database,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-institutional">
        <div className="relative px-6 py-10 sm:px-10">
          <div className="absolute inset-y-0 right-0 w-2 bg-accent" />
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-blue-100">
            FF Escrime · Commission Handisport
          </p>
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Le socle COMEH est opérationnel.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
            Cette première étape fournit l’authentification, les autorisations,
            l’audit et le modèle de données commun aux prochains modules.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-primary">Fondations disponibles</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {foundations.map(({ title, description, icon: Icon }) => (
            <article
              className="rounded-xl border border-primary/10 bg-card p-5 text-card-foreground shadow-sm"
              key={title}
            >
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary-50 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-primary/20 bg-secondary px-5 py-4">
        <p className="text-sm text-slate-600">
          Les fonctionnalités métier Frais et Rankings seront ajoutées lors des
          étapes suivantes. Aucun traitement métier n’est activé dans ce socle.
        </p>
      </section>
    </div>
  );
}
