export type Player = {
  id: number;
  first_name: string;
  last_name: string;
  category: string;
  gender?: string | null;
};

export type Tournament = {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  category: string | null;
  competition_type?: "tournament" | "league" | "flash";
  start_date: string | null;
  end_date: string | null;
  teams_per_group?: number | null;
  courts_count?: number | null;
  match_duration_minutes?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  club_name?: string | null;
  club_location?: string | null;
  club_logo_url?: string | null;
  status?: TournamentStatus;
};

export type Team = {
  id: number;
  tournament_id: number;
  players: {
    id: number;
    name: string;
    category?: string | null;
    gender?: string | null;
  }[];
  schedule_constraints?: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  is_admin?: boolean;
};

export type UserProfile = {
  id: number;
  email: string;
  club_name: string | null;
  club_location: string | null;
  club_logo_url: string | null;
  status?: "active" | "inactive";
  last_payment_paid_at?: string | null;
  last_payment_expires_at?: string | null;
  active_until?: string | null;
};

export type AdminUser = {
  id: number;
  email: string;
  club_name: string | null;
  club_location: string | null;
  club_logo_url: string | null;
  status?: "active" | "inactive";
  last_payment_paid_at?: string | null;
  last_payment_expires_at?: string | null;
  status_override?: "active" | "inactive" | null;
};

export type AdminMetrics = {
  total_users: number;
  active_users: number;
  inactive_users: number;
  total_revenue: number;
  ai_total_cost_usd: number;
};

export type AdminPayment = {
  id: number;
  user_id: number;
  user_email?: string | null;
  user_club_name?: string | null;
  paid_at: string;
  expires_at: string;
  plan_months?: number | null;
  amount?: number | string | null;
  currency: string;
  notes?: string | null;
};

export type AdminPaymentsSeries = {
  date: string;
  total: number;
};

export type SupportTicketStatus = "open" | "pending" | "closed";

export type SupportTicket = {
  id: number;
  user_id: number;
  subject: string;
  status: SupportTicketStatus;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
  user_email?: string | null;
  user_club_name?: string | null;
};

export type SupportMessage = {
  id: number;
  ticket_id: number;
  author_type: "user" | "admin";
  body: string;
  created_at: string;
};

export type SupportTicketDetail = SupportTicket & {
  messages: SupportMessage[];
};

export type TournamentStatus = "upcoming" | "ongoing" | "groups_finished" | "finished";

export type TournamentStatusResponse = {
  status: TournamentStatus;
};

export type TournamentStatusUpdate = {
  status: TournamentStatus;
};

export type GroupGenerateRequest = {
  teams_per_group: number;
  schedule_windows: {
    date: string;
    start_time: string;
    end_time: string;
  }[];
  match_duration_minutes: number;
  courts_count: number;
};

export type GroupTeamRef = {
  team_id: number;
};

export type TournamentGroup = {
  id: number;
  name: string;
  teams: GroupTeamRef[];
};

export type GroupScheduleConflictItem = {
  team_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  court_number: number | null;
  constraint?: string | null;
  reason?: string | null;
};

export type GroupScheduleConflict = {
  group_id: number;
  group_name: string;
  conflicts: GroupScheduleConflictItem[];
};

export type GenerateGroupsResponse = {
  message: string;
  groups: TournamentGroup[];
  schedule_conflicts?: GroupScheduleConflict[];
  generation_diagnostics?: {
    strategy?: "llm" | "deterministic";
    model?: string;
    attempted_models?: string[];
    last_error?: string | null;
  };
};

export type StartTournamentResponse = {
  id: number;
  status: TournamentStatus;
  message: string;
};

export type GroupTeamOut = {
  id: number;
  players: { name: string; category?: string | null; gender?: string | null }[];
};

export type TournamentGroupOut = {
  id: number;
  name: string;
  is_incompatible?: boolean;
  teams: GroupTeamOut[];
};

export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter"
  | "semi"
  | "final";
export type MatchStatus = "pending" | "ongoing" | "played";

export type MatchSet = {
  a: number;
  b: number;
};

export type Match = {
  id: number;
  match_code?: string | null;
  tournament_id: number;
  group_id: number | null;
  stage: MatchStage;
  category?: string | null;
  gender?: string | null;
  team_a_id: number | null;
  team_b_id: number | null;
  sets: MatchSet[] | null;
  winner_team_id: number | null;
  played_at: string | null;
  status: MatchStatus;
  scheduled_time?: string | null;
  scheduled_date?: string | null;
  court_number?: number | null;
};

export type PlayoffStage = Exclude<MatchStage, "group">;
export type PlayoffAutoMode =
  | "balanced"
  | "top_two_per_group"
  | "best_to_semi_quarter"
  | "play_in_lowest_ranked";

export type PlayoffGenerateRequest = {
  stage: PlayoffStage;
  auto_mode?: PlayoffAutoMode;
  manual_pairs?: { team_a_id: number; team_b_id: number }[];
  category?: string;
  gender?: string;
};

export type PlayoffManualSeed = {
  stage: PlayoffStage;
  match_index: number;
  side: "a" | "b";
  team_id: number;
  category: string;
  gender: string;
};

export type PlayoffManualSeedsUpsertRequest = {
  seeds: {
    stage: PlayoffStage;
    match_index: number;
    side: "a" | "b";
    team_id: number;
  }[];
  category?: string;
  gender?: string;
};

export type GroupStandingRow = {
  team: GroupTeamOut;
  played: number;
  won: number;
  lost: number;
  sets_for: number;
  sets_against: number;
  games_for: number;
  games_against: number;
  points: number;
  set_diff: number;
  game_diff: number;
};

export type GroupStandingsOut = {
  group_id: number;
  group_name: string;
  standings: GroupStandingRow[];
};
