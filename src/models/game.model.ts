export interface Game {
  id: string;
  league: string;
  teamA: string;
  teamB: string;
  startTime: Date;
  normalizedGameId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGameRequest {
  league: string;
  teamA: string;
  teamB: string;
  startTime: Date;
  normalizedGameId: string;
}

export interface UpdateGameRequest {
  league?: string;
  teamA?: string;
  teamB?: string;
  startTime?: Date;
  normalizedGameId?: string;
}

// Database table creation SQL
export const CREATE_GAMES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league VARCHAR(50) NOT NULL,
    team_a VARCHAR(100) NOT NULL,
    team_b VARCHAR(100) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    normalized_game_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_games_league ON games(league);
  CREATE INDEX IF NOT EXISTS idx_games_start_time ON games(start_time);
  CREATE INDEX IF NOT EXISTS idx_games_normalized_id ON games(normalized_game_id);
`;
