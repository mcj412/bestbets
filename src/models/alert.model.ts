export interface Alert {
  id: string;
  gameId: string;
  triggerType: string;
  details: Record<string, any>;
  createdAt: Date;
  isActive: boolean;
}

export interface CreateAlertRequest {
  gameId: string;
  triggerType: string;
  details: Record<string, any>;
}

export interface UpdateAlertRequest {
  triggerType?: string;
  details?: Record<string, any>;
  isActive?: boolean;
}

// Database table creation SQL
export const CREATE_ALERTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    trigger_type VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_game_id ON alerts(game_id);
  CREATE INDEX IF NOT EXISTS idx_alerts_trigger_type ON alerts(trigger_type);
  CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
  CREATE INDEX IF NOT EXISTS idx_alerts_is_active ON alerts(is_active);
`;
