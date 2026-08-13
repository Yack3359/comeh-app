import type { FencingCategoryValue } from "@/components/fencing-category";

export type { FencingCategoryValue };

export type Season = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type GenderValue = "FEMALE" | "MALE" | "OTHER";
export type WeaponValue = "EPEE" | "FLEURET" | "SABRE";
export type CompetitionFilters = {
  enabled: boolean;
  weapon: WeaponValue | "all";
  gender: GenderValue | "all";
  categoryExclude: FencingCategoryValue | "none";
};

export type AthleteCategory = {
  seasonId: string;
  category: FencingCategoryValue;
  rankingPoints: number | null;
  selectionCriteria: string | null;
  season: {
    label: string;
    startDate: string;
  };
};

export type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  gender: GenderValue;
  country: string;
  handedness: "RIGHT_HANDED" | "LEFT_HANDED" | null;
  gripType: "CROSS" | "STRAIGHT" | null;
  playStyle:
    | "OFFENSIVE"
    | "COUNTER_OFFENSIVE"
    | "DEFENSIVE"
    | "MIXED"
    | "OTHER"
    | null;
  club: string | null;
  pole: string | null;
  categorySeasons: AthleteCategory[];
  _count: {
    results: number;
    opponentResults: number;
  };
};

export type TeamMember = {
  id: string;
  bibNumber: number | null;
  athleteId: string;
  athlete: { firstName: string; lastName: string };
};

export type Team = {
  id: string;
  name: string;
  seasonId: string;
  season: { label: string };
  members: TeamMember[];
  _count: { results: number };
};

export type Competition = {
  id: string;
  name: string;
  location: string;
  country: string;
  date: string;
  level: string;
  seasonId: string;
  weapon: WeaponValue | null;
  gender: GenderValue | null;
  category: FencingCategoryValue | null;
  isSelective: boolean;
  season: { label: string };
  _count: { results: number };
};

export type RankingResult = {
  id: string;
  type: "ranking" | "bout";
  participantType: "athlete" | "team";
  competitionId: string;
  athleteId: string | null;
  teamId: string | null;
  opponentAthleteId: string | null;
  opponentTeamName: string | null;
  rank: number | null;
  seedRank: number | null;
  poolRank: number | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  round: string | null;
  won: boolean | null;
  observations: string | null;
  competition: {
    name: string;
    date: string;
    seasonId: string;
    season: { label: string };
  };
  athlete: { firstName: string; lastName: string } | null;
  team: { name: string } | null;
  opponentAthlete: { firstName: string; lastName: string } | null;
};

export type OpponentStatsData = {
  groupBy: "country" | "handedness" | "gripType" | "playStyle";
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  groups: Array<{
    key: string;
    total: number;
    wins: number;
    losses: number;
    winRate: number;
  }>;
};

export type SelectionHelperAthlete = {
  athleteId: string;
  firstName: string;
  lastName: string;
  club: string | null;
  country: string;
  rankingPoints: number | null;
  selectionCriteria: string | null;
  competitionCount: number;
  bestRank: number | null;
  boutCount: number;
  wins: number;
  winRate: number;
};

export type AthleteHistoryData = {
  id: string;
  firstName: string;
  lastName: string;
  seasons: Array<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    category: FencingCategoryValue | null;
    rankings: Array<{
      id: string;
      rank: number;
      seedRank: number | null;
      poolRank: number | null;
      competition: {
        id: string;
        name: string;
        date: string;
        level: string;
        season: {
          id: string;
          label: string;
          startDate: string;
          endDate: string;
        };
      };
    }>;
  }>;
};
