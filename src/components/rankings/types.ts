export type Season = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type AthleteCategory = {
  seasonId: string;
  category: string;
  season: {
    label: string;
    startDate: string;
  };
};

export type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  gender: "FEMALE" | "MALE" | "OTHER";
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
  categorySeasons: AthleteCategory[];
  _count: {
    results: number;
    opponentResults: number;
  };
};

export type Team = {
  id: string;
  name: string;
  seasonId: string;
  season: { label: string };
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
  rank: number | null;
  score: string | null;
  round: string | null;
  won: boolean | null;
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

export type AthleteHistoryData = {
  id: string;
  firstName: string;
  lastName: string;
  seasons: Array<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    category: string | null;
    rankings: Array<{
      id: string;
      rank: number;
      score: string | null;
      round: string | null;
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
