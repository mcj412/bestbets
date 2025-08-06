import { Pool, PoolClient } from 'pg';
import {
    CREATE_ALERTS_TABLE_SQL,
    CREATE_GAMES_TABLE_SQL,
    CREATE_ODDS_SNAPSHOTS_TABLE_SQL,
} from '../models';
import config from '../utils/config';
import logger from '../utils/logger';

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      logger.info('Database connected successfully');
      client.release();
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async initializeTables(): Promise<void> {
    try {
      const client = await this.pool.connect();

      // Create tables in order (respecting foreign key constraints)
      await client.query(CREATE_GAMES_TABLE_SQL);
      await client.query(CREATE_ODDS_SNAPSHOTS_TABLE_SQL);
      await client.query(CREATE_ALERTS_TABLE_SQL);

      client.release();
      logger.info('Database tables initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database tables:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      logger.error('Query error:', { text, error });
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

// Export singleton instance
export const dbService = new DatabaseService();
export default dbService;
