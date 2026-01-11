export type Player = {
  id: number;
  first_name: string;
  last_name: string;
  category: string;
};

export type Tournament = {
  id: number;
  name: string;
  category: string | null;
  start_date: string | null;
};

export type Team = {
  id: number;
  tournament_id: number;
  players: {
    id: number;
    name: string;
  }[];
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
};

export type TournamentStatus = "upcoming" | "ongoing" | "finished";

export type TournamentStatusResponse = {
  status: TournamentStatus;
};

export type TournamentStatusUpdate = {
  status: TournamentStatus;
};

export type GroupGenerateRequest = {
  teams_per_group: number;
};

export type GroupTeamRef = {
  team_id: number;
};

export type TournamentGroup = {
  id: number;
  name: string;
  teams: GroupTeamRef[];
};

export type GenerateGroupsResponse = {
  message: string;
  groups: TournamentGroup[];
};

export type StartTournamentResponse = {
  id: number;
  status: TournamentStatus;
  message: string;
};

export type GroupTeamOut = {
  id: number;
  players: { name: string }[];
};

export type TournamentGroupOut = {
  id: number;
  name: string;
  teams: GroupTeamOut[];
};
