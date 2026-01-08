export type Player = {
  id: number;
  name: string;
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
