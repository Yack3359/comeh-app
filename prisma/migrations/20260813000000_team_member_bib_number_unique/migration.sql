-- Le numéro de maillot représente la position dans la composition de
-- l'équipe : deux tireurs de la même équipe ne peuvent pas porter le même
-- numéro (les NULL restent autorisés en plusieurs exemplaires, un tireur
-- peut être ajouté sans numéro).
CREATE UNIQUE INDEX "team_members_team_id_bib_number_key" ON "team_members"("team_id", "bib_number");
