export interface OddsSnapshot {
  id: string;
  gameId: string;
  siteName: string;
  spread: number | null;
  moneyline: number | null;
  overUnder: number | null;
  oddsPercent: number | null;
  timestamp: Date;
  createdAt: Date;
}

export interface CreateOddsSnapshotRequest {
  gameId: string;
  siteName: string;
  spread?: number;
  moneyline?: number;
  overUnder?: number;
  oddsPercent?: number;
  timestamp: Date;
}

export interface UpdateOddsSnapshotRequest {
  spread?: number;
  moneyline?: number;
  overUnder?: number;
  oddsPercent?: number;
  timestamp?: Date;
}

// Database table creation SQL
export const CREATE_ODDS_SNAPSHOTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS odds_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    site_name VARCHAR(100) NOT NULL,
    spread DECIMAL(5,2),
    moneyline INTEGER,
    over_under DECIMAL(5,2),
    odds_percent DECIMAL(5,2),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_odds_game_id ON odds_snapshots(game_id);
  CREATE INDEX IF NOT EXISTS idx_odds_site_name ON odds_snapshots(site_name);
  CREATE INDEX IF NOT EXISTS idx_odds_timestamp ON odds_snapshots(timestamp);
  CREATE INDEX IF NOT EXISTS idx_odds_game_site_timestamp ON odds_snapshots(game_id, site_name, timestamp);
`;
