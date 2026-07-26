# COMEH — Socle applicatif

Socle technique de l’outil de la Commission Escrime Handisport. Cette étape
comprend uniquement l’authentification, les rôles, l’audit, le layout général et
le modèle de données partagé. Les fonctionnalités métier **Frais** et
**Rankings** ne sont pas encore implémentées.

## Stack

- Next.js 14, App Router et TypeScript
- Tailwind CSS et configuration shadcn/ui
- PostgreSQL et Prisma ORM
- NextAuth.js avec fournisseur Credentials
- bcrypt pour le hachage des mots de passe (`bcryptjs`, implémentation sans
  dépendance native)

## Prérequis

- Node.js 20 LTS
- npm 10+
- PostgreSQL 15+ accessible localement ou à distance

## Installation

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Créer le fichier d’environnement :

   ```bash
   cp .env.example .env
   ```

   Sous PowerShell :

   ```powershell
   Copy-Item .env.example .env
   ```

3. Renseigner au minimum `DATABASE_URL`, `NEXTAUTH_SECRET`,
   `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans `.env`. Le mot de passe administrateur
   doit contenir au moins 12 caractères.

4. Créer et appliquer la migration initiale :

   ```bash
   npm run prisma:migrate -- --name init
   ```

5. Charger l’administrateur et les saisons d’exemple :

   ```bash
   npm run prisma:seed
   ```

6. Démarrer l’application :

   ```bash
   npm run dev
   ```

   L’application est disponible sur <http://localhost:3000>.

## Scripts

| Commande | Usage |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production après le build |
| `npm run lint` | Vérification ESLint |
| `npm run prisma:generate` | Régénère le client Prisma |
| `npm run prisma:migrate` | Crée/applique les migrations de développement |
| `npm run prisma:deploy` | Applique les migrations versionnées en production |
| `npm run prisma:seed` | Charge les données de départ |
| `npm run prisma:studio` | Ouvre Prisma Studio |

## Authentification et rôles

Le fournisseur Credentials vérifie l’adresse e-mail et le mot de passe bcrypt
stocké dans `User.passwordHash`. Les sessions utilisent des JWT signés par
NextAuth. Les rôles disponibles sont :

- `admin`
- `comeh_member`
- `readonly`

Le middleware protège toutes les pages et routes API, hors pages de connexion et
endpoints internes NextAuth. Les routes API doivent également effectuer leur
contrôle d’autorisation côté serveur avec `runAsAuthenticatedUser`. Ce helper
accepte si nécessaire une liste de rôles autorisés.

## Journal d’audit

Les mutations Prisma exécutées dans `runAsAuthenticatedUser` héritent de
l’identité de la session via un contexte asynchrone. Le middleware Prisma écrit
automatiquement une entrée `AuditLog` pour les créations, mises à jour, upserts
et suppressions.

Chaque entrée contient l’utilisateur, l’action, le type et l’identifiant de
l’entité, ainsi qu’un objet `diffJson` avant/après. Les champs de mot de passe
sont systématiquement masqués. La route `PATCH /api/account` fournit un exemple
minimal et transversal de mutation authentifiée/auditée.

## Données de démonstration

Le seed est idempotent. Il crée ou met à jour :

- le compte administrateur défini par les variables `ADMIN_*` ;
- les saisons `23/24`, `24/25` et `25/26` ;
- les exercices fiscaux correspondants.

La saison `25/26` couvre le 1er septembre 2025 au 31 juillet 2026 et est reliée
aux exercices fiscaux 2025 et 2026.

## Mise en production

Utiliser une valeur aléatoire longue pour `NEXTAUTH_SECRET`, une URL HTTPS pour
`NEXTAUTH_URL` et un compte PostgreSQL dédié avec des droits limités. NextAuth
active les cookies `httpOnly` et les marque `secure` en environnement HTTPS.
