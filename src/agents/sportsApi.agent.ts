import axios from 'axios';
import config from '../utils/config';
import logger from '../utils/logger';

export interface SportsApiGame {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
}

export interface SportsApiResponse {
  games: SportsApiGame[];
  timestamp: string;
}

export interface LeagueSchedule {
  league: string;
  games: SportsApiGame[];
  lastUpdated: string;
}

class SportsApiAgent {
  private baseUrl = 'https://api.the-odds-api.com/v4/sports';
  private apiKey = config.api.sportsApiKey;

  async getAvailableSports(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}`, {
        params: { apiKey: this.apiKey }
      });
      logger.info(`Fetched ${response.data.length} available sports`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch available sports:', error);
      throw error;
    }
  }

  async getGames(sportKey: string = 'basketball_nba'): Promise<SportsApiGame[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/${sportKey}/odds`, {
        params: {
          apiKey: this.apiKey,
          regions: 'us',
          markets: 'spreads,totals,h2h'
        }
      });

      const games = response.data.map((game: any) => ({
        id: game.id,
        sport: sportKey,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: game.commence_time,
        status: game.status
      }));

      logger.info(`Fetched ${games.length} games for ${sportKey}`);
      return games;
    } catch (error) {
      logger.error(`Failed to fetch games for ${sportKey}:`, error);
      throw error;
    }
  }

  async getLeagueSchedule(sportKey: string = 'basketball_nba'): Promise<LeagueSchedule> {
    try {
      // Get all upcoming games for the league
      const response = await axios.get(`${this.baseUrl}/${sportKey}/odds`, {
        params: {
          apiKey: this.apiKey,
          regions: 'us',
          markets: 'spreads,totals,h2h'
        }
      });

      const games = response.data.map((game: any) => ({
        id: game.id,
        sport: sportKey,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: game.commence_time,
        status: game.status
      }));

      // Filter for upcoming games only
      const upcomingGames = games.filter((game: SportsApiGame) =>
        game.status === 'upcoming' || new Date(game.startTime) > new Date()
      );

      logger.info(`Fetched ${upcomingGames.length} upcoming games for ${sportKey}`);

      return {
        league: sportKey,
        games: upcomingGames,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to fetch league schedule for ${sportKey}:`, error);
      throw error;
    }
  }

  async getOdds(sportKey: string = 'basketball_nba'): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/${sportKey}/odds`, {
        params: {
          apiKey: this.apiKey,
          regions: 'us',
          markets: 'spreads,totals,h2h'
        }
      });

      logger.info(`Fetched odds for ${response.data.length} games`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch odds for ${sportKey}:`, error);
      throw error;
    }
  }
}

export const sportsApiAgent = new SportsApiAgent();
export default sportsApiAgent;
