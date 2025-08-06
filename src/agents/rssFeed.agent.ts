import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

// Add Puppeteer import
const puppeteer = require('puppeteer');

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
      logger.info('Reading enhanced RSS feed with odds data...');

      // Read from the enhanced JSON file with odds data
      const filePath = path.join(__dirname, '../../rss_with_odds.json');

      if (!fs.existsSync(filePath)) {
        throw new Error('Enhanced RSS file with odds not found. Run the Puppeteer script first.');
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const enhancedData = JSON.parse(content);
      logger.info(`Read enhanced RSS data with ${enhancedData.totalArticlesWithOdds || 0} articles with odds`);

      // Convert enhanced data back to RSSFeedData format
      const items: RSSFeedItem[] = [];

      if (enhancedData.articlesWithOdds) {
        enhancedData.articlesWithOdds.forEach((article: any) => {
          const rssItem = article.rssItem;
          const oddsData = article.oddsData;

          // Create enhanced description with odds information
          let enhancedDescription = rssItem.description || '';

          if (oddsData.tables && oddsData.tables.length > 0) {
            enhancedDescription += '\n\n📊 Odds Tables Found:';
            oddsData.tables.forEach((table: any, index: number) => {
              enhancedDescription += `\nTable ${index + 1}: ${table.headers.join(' | ')}`;
              if (table.rows.length > 0) {
                enhancedDescription += `\n${table.rows.slice(0, 3).map((row: any) => row.join(' | ')).join('\n')}`;
                if (table.rows.length > 3) {
                  enhancedDescription += `\n... and ${table.rows.length - 3} more rows`;
                }
              }
            });
          }

          if (oddsData.odds && oddsData.odds.length > 0) {
            enhancedDescription += `\n\n🎯 Odds Patterns: ${oddsData.odds.slice(0, 10).join(', ')}`;
            if (oddsData.odds.length > 10) {
              enhancedDescription += ` (and ${oddsData.odds.length - 10} more)`;
            }
          }

          items.push({
            title: rssItem.title,
            link: rssItem.link,
            description: enhancedDescription,
            pubDate: rssItem.pubDate,
            category: rssItem.category || 'Enhanced with Odds'
          });
        });
      } else if (enhancedData.items) {
        // Fallback to regular RSS items if no enhanced data
        items.push(...enhancedData.items);
      }

      return {
        title: enhancedData.channel?.title || 'Enhanced RSS Feed with Odds',
        description: enhancedData.channel?.description || 'RSS feed with extracted odds data',
        link: enhancedData.channel?.link || '',
        items: items,
        lastUpdated: enhancedData.lastUpdated || new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to read enhanced RSS feed:', error);
      throw error;
    }
  }

  private async getRSSWithPuppeteer(): Promise<string | null> {
    const browser = await puppeteer.launch({
      headless: true, // Run in background
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();

      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      logger.info('Navigating to RSS feed with Puppeteer...');

      // Go directly to the RSS feed
      await page.goto(this.rssUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait a bit for any JavaScript to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get the page content
      const content = await page.content();

      logger.info(`Puppeteer content length: ${content.length}`);

      return content;

    } catch (error) {
      logger.error('Puppeteer error:', error);
      return null;
    } finally {
      await browser.close();
    }
  }

  private getFallbackRSSData(): RSSFeedData {
    return {
      title: 'IonoI Bets - Sports Data',
      description: 'Sports odds and game information',
      link: 'https://ionoi-bets.com',
      items: [
        {
          title: 'Lakers vs Warriors - NBA Game Tonight',
          link: 'https://example.com/game1',
          description: 'Los Angeles Lakers take on Golden State Warriors. Lakers -3.5, O/U 220.5',
          pubDate: new Date().toISOString(),
          category: 'NBA'
        },
        {
          title: 'Chiefs vs Bills - NFL Sunday Night Football',
          link: 'https://example.com/game2',
          description: 'Kansas City Chiefs vs Buffalo Bills. Chiefs +2.5, O/U 48.5',
          pubDate: new Date().toISOString(),
          category: 'NFL'
        },
        {
          title: 'Yankees vs Red Sox - MLB Rivalry Game',
          link: 'https://example.com/game3',
          description: 'New York Yankees vs Boston Red Sox. Yankees -1.5, O/U 9.5',
          pubDate: new Date().toISOString(),
          category: 'MLB'
        },
        {
          title: 'Heat vs Celtics - NBA Eastern Conference',
          link: 'https://example.com/game4',
          description: 'Miami Heat vs Boston Celtics. Heat +4.5, O/U 215.5',
          pubDate: new Date().toISOString(),
          category: 'NBA'
        },
        {
          title: 'Cowboys vs Eagles - NFL NFC East Battle',
          link: 'https://example.com/game5',
          description: 'Dallas Cowboys vs Philadelphia Eagles. Cowboys -1.5, O/U 45.5',
          pubDate: new Date().toISOString(),
          category: 'NFL'
        }
      ],
      lastUpdated: new Date().toISOString()
    };
  }

  private parseXML(xmlData: string): RSSFeedData {
    try {
      logger.info('XML Data sample (first 1000 chars):', xmlData.substring(0, 1000));
      logger.info('XML Data length:', xmlData.length);

      // Check if the content is HTML-encoded (Puppeteer returns HTML with encoded XML)
      let actualXML = xmlData;

      // If it's wrapped in HTML, extract the XML content
      if (xmlData.includes('<html>') && xmlData.includes('<pre>')) {
        // Extract content from <pre> tags
        const preMatch = xmlData.match(/<pre[^>]*>(.*?)<\/pre>/s);
        if (preMatch && preMatch[1]) {
          actualXML = preMatch[1];
          // Decode HTML entities
          actualXML = actualXML
            .replace(/&amp;lt;/g, '<')
            .replace(/&amp;gt;/g, '>')
            .replace(/&amp;amp;/g, '&')
            .replace(/&amp;quot;/g, '"')
            .replace(/&amp;apos;/g, "'")
            .replace(/&amp;nbsp;/g, ' ');
        }
      }

      // Check if it's actually XML
      if (!actualXML.includes('<?xml') && !actualXML.includes('<rss') && !actualXML.includes('<feed')) {
        logger.error('Response does not appear to be XML/RSS');
        logger.error('First 200 chars:', actualXML.substring(0, 200));
        logger.error('Contains XML declaration:', actualXML.includes('<?xml'));
        logger.error('Contains RSS tag:', actualXML.includes('<rss'));
        logger.error('Contains feed tag:', actualXML.includes('<feed'));
        throw new Error('Response is not valid XML/RSS');
      }

      // Simple XML parsing using regex
      const titleMatch = actualXML.match(/<title>(.*?)<\/title>/);
      const descriptionMatch = actualXML.match(/<description>(.*?)<\/description>/);
      const linkMatch = actualXML.match(/<link>(.*?)<\/link>/);

      // Extract all items - try different patterns
      let items: RSSFeedItem[] = [];

      // First try the standard RSS item pattern
      const itemRegex = /<item>(.*?)<\/item>/gs;
      let match;
      let itemCount = 0;

      while ((match = itemRegex.exec(actualXML)) !== null) {
        itemCount++;
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

      logger.info(`Found ${itemCount} items using standard RSS pattern`);

      // If no items found, try alternative patterns
      if (items.length === 0) {
        logger.info('No items found with standard pattern, trying alternative patterns...');

        // Try looking for any content that might be items
        const alternativeItemRegex = /<entry>(.*?)<\/entry>/gs;
        while ((match = alternativeItemRegex.exec(actualXML)) !== null) {
          itemCount++;
          const itemContent = match[1];
          if (itemContent) {
            const itemTitle = itemContent.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const itemLink = itemContent.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const itemDescription = itemContent.match(/<summary>(.*?)<\/summary>/)?.[1] || '';
            const itemPubDate = itemContent.match(/<published>(.*?)<\/published>/)?.[1] || '';
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

        logger.info(`Found ${items.length} items using alternative pattern`);
      }

      // If still no items, try to find any content that looks like items
      if (items.length === 0) {
        logger.info('Still no items found, trying to extract any content...');

        // Look for any content between tags that might be items
        const contentRegex = /<([^>]+)>([^<]*)<\/\1>/g;
        const foundContent: string[] = [];
        let contentMatch;

        while ((contentMatch = contentRegex.exec(actualXML)) !== null) {
          const tagName = contentMatch[1];
          const content = contentMatch[2]?.trim() || '';
          if (content.length > 10 && !foundContent.includes(content)) {
            foundContent.push(content);
          }
        }

        logger.info(`Found ${foundContent.length} potential content items`);
        logger.info('Sample content:', foundContent.slice(0, 3));
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

  async saveRSSFeedToFile(): Promise<void> {
    try {
      logger.info('Fetching RSS feed and saving to file...');
      const response = await axios.get(this.rssUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        },
        maxRedirects: 10,
        validateStatus: (status) => status < 500
      });

      const content = response.data;
      const filePath = path.join(__dirname, '../../rss_feed_content.txt');

      fs.writeFileSync(filePath, content, 'utf8');
      logger.info(`RSS feed content saved to: ${filePath}`);
      logger.info(`Content length: ${content.length} characters`);
      logger.info(`Response status: ${response.status}`);
      logger.info(`Response headers: ${JSON.stringify(response.headers, null, 2)}`);

    } catch (error) {
      logger.error('Failed to save RSS feed to file:', error);
      throw error;
    }
  }
}

export const rssFeedAgent = new RSSFeedAgent();
export default rssFeedAgent;
