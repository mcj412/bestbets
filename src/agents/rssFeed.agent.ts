import axios from 'axios';
import logger from '../utils/logger';

export interface RSSFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string;
}

export interface RSSFeedData {
  title: string;
  description: string;
  link: string;
  items: RSSFeedItem[];
  lastUpdated: string;
}

export interface ParsedGameData {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime?: string;
  status: string;
  odds?: {
    spread?: string;
    total?: string;
    moneyline?: string;
  } | undefined;
  source: string;
}

class RSSFeedAgent {
  private rssUrl = 'https://www.oddsshark.com/rss.xml';

  async getRSSFeed(): Promise<RSSFeedData> {
    try {
      logger.info('Fetching RSS feed from:', this.rssUrl);
      const response = await axios.get(this.rssUrl, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      logger.info('RSS feed response status:', response.status);

      // Parse XML using regex since we don't have fast-xml-parser
      const xmlData = response.data;
      const feedData = this.parseXML(xmlData);

      logger.info(`Fetched ${feedData.items.length} items from RSS feed`);
      return feedData;
    } catch (error) {
      logger.error('Failed to fetch RSS feed:', error);
      throw error;
    }
  }

  private parseXML(xmlData: string): RSSFeedData {
    try {
      // Simple XML parsing using regex
      const titleMatch = xmlData.match(/<title>(.*?)<\/title>/);
      const descriptionMatch = xmlData.match(/<description>(.*?)<\/description>/);
      const linkMatch = xmlData.match(/<link>(.*?)<\/link>/);

      // Extract all items
      const itemRegex = /<item>(.*?)<\/item>/gs;
      const items: RSSFeedItem[] = [];
      let match;

      while ((match = itemRegex.exec(xmlData)) !== null) {
        const itemContent = match[1];
        if (itemContent) {
          const itemTitle = itemContent.match(/<title>(.*?)<\/title>/)?.[1] || '';
          const itemLink = itemContent.match(/<link>(.*?)<\/link>/)?.[1] || '';
          const itemDescription = itemContent.match(/<description>(.*?)<\/description>/)?.[1] || '';
          const itemPubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
          const itemCategory = itemContent.match(/<category>(.*?)<\/category>/)?.[1] || '';

          items.push({
            title: itemTitle,
            link: itemLink,
            description: itemDescription,
            pubDate: itemPubDate,
            category: itemCategory
          });
        }
      }

      return {
        title: titleMatch?.[1] || 'Oddsshark RSS Feed',
        description: descriptionMatch?.[1] || '',
        link: linkMatch?.[1] || '',
        items: items,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to parse XML:', error);
      throw new Error('Failed to parse RSS XML');
    }
  }

  async getGamesFromRSS(): Promise<ParsedGameData[]> {
    try {
      const feedData = await this.getRSSFeed();
      const games: ParsedGameData[] = [];

      for (const item of feedData.items) {
        const parsedGame = this.parseGameFromItem(item);
        if (parsedGame) {
          games.push(parsedGame);
        }
      }

      logger.info(`Parsed ${games.length} games from RSS feed`);
      return games;
    } catch (error) {
      logger.error('Failed to parse games from RSS feed:', error);
      throw error;
    }
  }

  private parseGameFromItem(item: RSSFeedItem): ParsedGameData | null {
    try {
      // Extract game information from title and description
      const title = item.title.toLowerCase();
      const description = item.description.toLowerCase();

      // Look for common sports patterns
      const sport = this.extractSport(title, description);
      if (!sport) return null;

      // Extract team names
      const teams = this.extractTeams(title, description);
      if (!teams || teams.length < 2) return null;

      // Extract odds information
      const odds = this.extractOdds(title, description);

      // Generate a unique ID
      const id = `rss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        id,
        sport,
        homeTeam: teams[1] || '', // Second team is usually home team
        awayTeam: teams[0] || '', // First team is usually away team
        status: 'upcoming',
        odds,
        source: 'oddsshark_rss'
      };
    } catch (error) {
      logger.error('Failed to parse game from RSS item:', error);
      return null;
    }
  }

  private extractSport(title: string, description: string): string | null {
    const text = `${title} ${description}`;

    if (text.includes('nba') || text.includes('basketball')) {
      return 'basketball_nba';
    }
    if (text.includes('nfl') || text.includes('football')) {
      return 'americanfootball_nfl';
    }
    if (text.includes('mlb') || text.includes('baseball')) {
      return 'baseball_mlb';
    }
    if (text.includes('nhl') || text.includes('hockey')) {
      return 'icehockey_nhl';
    }
    if (text.includes('soccer') || text.includes('fifa')) {
      return 'soccer';
    }

    return null;
  }

  private extractTeams(title: string, description: string): string[] | null {
    const text = `${title} ${description}`;

    // Common team name patterns
    const teamPatterns = [
      // NBA Teams
      'lakers', 'celtics', 'warriors', 'heat', 'bulls', 'knicks', 'suns', 'mavericks',
      'bucks', '76ers', 'nets', 'clippers', 'nuggets', 'jazz', 'trail blazers',
      'thunder', 'pelicans', 'kings', 'timberwolves', 'rockets', 'spurs', 'grizzlies',
      'magic', 'hawks', 'hornets', 'pistons', 'pacers', 'cavaliers', 'raptors',
      'wizards', 'knicks', 'heat', 'magic', 'hawks', 'hornets', 'pistons',

      // NFL Teams
      'chiefs', 'bills', '49ers', 'cowboys', 'packers', 'lions', 'patriots', 'jets',
      'dolphins', 'bills', 'steelers', 'browns', 'bengals', 'ravens', 'titans',
      'jaguars', 'colts', 'texans', 'broncos', 'raiders', 'chargers', 'chiefs',
      'eagles', 'giants', 'commanders', 'cardinals', 'rams', 'seahawks', 'falcons',
      'panthers', 'saints', 'buccaneers', 'vikings', 'bears', 'lions', 'packers',

      // MLB Teams
      'yankees', 'red sox', 'dodgers', 'giants', 'cubs', 'cardinals', 'mets',
      'phillies', 'braves', 'marlins', 'nationals', 'orioles', 'blue jays',
      'rays', 'white sox', 'indians', 'tigers', 'royals', 'twins', 'astros',
      'rangers', 'athletics', 'mariners', 'angels', 'rockies', 'diamondbacks',
      'padres', 'brewers', 'reds', 'pirates'
    ];

    const foundTeams: string[] = [];

    for (const team of teamPatterns) {
      if (text.includes(team) && !foundTeams.includes(team)) {
        foundTeams.push(team);
      }
    }

    return foundTeams.length >= 2 ? foundTeams.slice(0, 2) : null;
  }

  private extractOdds(title: string, description: string): { spread?: string; total?: string; moneyline?: string } | undefined {
    const text = `${title} ${description}`;
    const odds: { spread?: string; total?: string; moneyline?: string } = {};

    // Extract spread (e.g., -3.5, +7)
    const spreadMatch = text.match(/([+-]\d+\.?\d*)\s*(point|pt|pts)/i);
    if (spreadMatch && spreadMatch[1]) {
      odds.spread = spreadMatch[1];
    }

    // Extract total (e.g., O/U 220.5)
    const totalMatch = text.match(/(?:o\/u|over\/under|total)\s*(\d+\.?\d*)/i);
    if (totalMatch && totalMatch[1]) {
      odds.total = totalMatch[1];
    }

    // Extract moneyline (e.g., -110, +150)
    const moneylineMatch = text.match(/([+-]\d{3,4})/g);
    if (moneylineMatch && moneylineMatch.length >= 2) {
      odds.moneyline = moneylineMatch.slice(0, 2).join(' / ');
    }

    return Object.keys(odds).length > 0 ? odds : undefined;
  }

  async getLeagueScheduleFromRSS(sportKey: string = 'basketball_nba'): Promise<{ league: string; games: ParsedGameData[]; lastUpdated: string }> {
    try {
      const games = await this.getGamesFromRSS();
      const filteredGames = games.filter(game => game.sport === sportKey);

      return {
        league: sportKey,
        games: filteredGames,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to get league schedule from RSS for ${sportKey}:`, error);
      throw error;
    }
  }
}

export const rssFeedAgent = new RSSFeedAgent();
export default rssFeedAgent;
