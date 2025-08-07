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
  odds?: any; // Add structured odds data
  aiAnalysis?: any; // Add AI analysis data
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

      // First, try to read from AI-enhanced data if available
      const aiDataPath = path.join(__dirname, '../../ai_enhanced_sports_data.json');
      if (fs.existsSync(aiDataPath)) {
        logger.info('Found AI-enhanced data, using that instead...');
        const aiContent = fs.readFileSync(aiDataPath, 'utf8');
        const aiData = JSON.parse(aiContent);

        // Convert AI-enhanced data to RSSFeedData format
        const items: RSSFeedItem[] = [];

        if (aiData.articles) {
          aiData.articles.forEach((article: any) => {
            // Create RSS item from AI-enhanced article
            const rssItem: RSSFeedItem = {
              title: article.title,
              link: article.link,
              description: article.description || '',
              pubDate: article.pubDate,
              category: article.category,
              odds: article.oddsData ? this.parseOddsData(article.oddsData, article.title) : undefined,
              aiAnalysis: article.aiAnalysis // Add AI analysis to the item
            };

            // Add AI analysis to the description if available
            if (article.aiAnalysis) {
              let enhancedDescription = rssItem.description;

              // Add AI insights
              if (article.aiAnalysis.keyInsights && article.aiAnalysis.keyInsights.length > 0) {
                enhancedDescription += `\n\n🤖 **AI Insights:**`;
                article.aiAnalysis.keyInsights.forEach((insight: string) => {
                  enhancedDescription += `\n• ${insight}`;
                });
              }

              // Add confidence and risk assessment
              enhancedDescription += `\n\n📊 **AI Confidence:** ${article.aiAnalysis.confidencePercentage}%`;
              enhancedDescription += `\n⚠️ **Risk Level:** ${article.aiAnalysis.riskAssessment}`;

              // Add general consensus
              if (article.aiAnalysis.generalConsensus) {
                enhancedDescription += `\n\n🎯 **Market Consensus:** ${article.aiAnalysis.generalConsensus}`;
              }

              // Add black swan events
              if (article.aiAnalysis.blackSwanEvents && article.aiAnalysis.blackSwanEvents.length > 0) {
                enhancedDescription += `\n\n⚡ **Black Swan Events:**`;
                article.aiAnalysis.blackSwanEvents.forEach((event: string) => {
                  enhancedDescription += `\n• ${event}`;
                });
              }

              rssItem.description = enhancedDescription;
            }

            items.push(rssItem);
          });
        }

        return {
          title: 'AI-Enhanced Sports Data',
          description: `AI-analyzed sports betting data with ${items.length} articles`,
          link: 'https://www.oddsshark.com/rss.xml',
          items: items,
          lastUpdated: aiData.lastAIUpdate || new Date().toISOString()
        };
      }

      // Fallback to regular enhanced RSS data
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

          // Parse the odds data into clean, structured format
          const parsedOdds = this.parseOddsData(oddsData, rssItem.title);

          // Create enhanced description with clean odds information
          let enhancedDescription = rssItem.description || '';

          if (parsedOdds.teams.length > 0) {
            enhancedDescription += `\n\n🏈 **Teams:** ${parsedOdds.teams.join(' vs ')}`;
          }

          if (parsedOdds.spread && parsedOdds.spread.length > 0) {
            enhancedDescription += `\n📏 **Spread:** ${parsedOdds.spread.map((sp: any) => `${sp.team} ${sp.line} (${sp.odds})`).join(', ')}`;
          }

          if (parsedOdds.moneyline && parsedOdds.moneyline.length > 0) {
            enhancedDescription += `\n💰 **Moneyline:** ${parsedOdds.moneyline.map((ml: any) => `${ml.team} ${ml.odds}`).join(', ')}`;
          }

          if (parsedOdds.total) {
            enhancedDescription += `\n📊 **Total:** ${parsedOdds.total.line} (Over: ${parsedOdds.total.over}, Under: ${parsedOdds.total.under})`;
          }

          if (parsedOdds.playerProps && parsedOdds.playerProps.length > 0) {
            enhancedDescription += `\n👤 **Player Props:**`;
            parsedOdds.playerProps.slice(0, 5).forEach((prop: any) => {
              enhancedDescription += `\n   • ${prop.player}: ${prop.odds}`;
            });
            if (parsedOdds.playerProps.length > 5) {
              enhancedDescription += `\n   ... and ${parsedOdds.playerProps.length - 5} more`;
            }
          }

          if (parsedOdds.fighters && parsedOdds.fighters.length > 0) {
            enhancedDescription += `\n🥊 **Fighters:**`;
            parsedOdds.fighters.forEach((fighter: any) => {
              enhancedDescription += `\n   • ${fighter.name}: ${fighter.odds}`;
            });
          }

          // Add summary of tables found
          if (oddsData.tables && oddsData.tables.length > 0) {
            enhancedDescription += `\n\n📋 **Data Tables:** ${oddsData.tables.length} table(s) extracted`;
          }

          // Add summary of odds patterns
          if (oddsData.odds && oddsData.odds.length > 0) {
            enhancedDescription += `\n🎯 **Odds Found:** ${oddsData.odds.length} odds patterns detected`;
          }

          items.push({
            title: rssItem.title,
            link: rssItem.link,
            description: enhancedDescription,
            pubDate: rssItem.pubDate,
            category: rssItem.category || 'Enhanced with Odds',
            odds: parsedOdds // Include the structured odds data
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

  private parseOddsData(oddsData: any, articleTitle: string): any {
    const result: {
      teams: string[];
      spread: Array<{team: string; line: string; odds: string}>;
      moneyline: Array<{team: string; odds: string}>;
      total: {over: string; under: string; line: string} | null;
      playerProps: Array<{player: string; team: string; prop: string; odds: string}>;
      fighters: Array<{name: string; odds: string}>;
      keyOdds: Array<{type: string; description: string; value: string}>;
    } = {
      teams: [],
      spread: [],
      moneyline: [],
      total: null,
      playerProps: [],
      fighters: [],
      keyOdds: []
    };

    try {
      // Extract teams from article title
      const title = articleTitle.toLowerCase();

      // Common team patterns
      const teamPatterns = {
        // NFL Teams
        'patriots': 'Patriots', 'commanders': 'Commanders', 'bengals': 'Bengals', 'eagles': 'Eagles',
        'chiefs': 'Chiefs', 'bills': 'Bills', '49ers': '49ers', 'cowboys': 'Cowboys',
        'packers': 'Packers', 'lions': 'Lions', 'jets': 'Jets', 'dolphins': 'Dolphins',
        'steelers': 'Steelers', 'browns': 'Browns', 'ravens': 'Ravens',
        'titans': 'Titans', 'jaguars': 'Jaguars', 'colts': 'Colts', 'texans': 'Texans',
        'broncos': 'Broncos', 'raiders': 'Raiders', 'chargers': 'Chargers',
        'cardinals': 'Cardinals', 'rams': 'Rams', 'seahawks': 'Seahawks', 'falcons': 'Falcons',
        'panthers': 'Panthers', 'saints': 'Saints', 'buccaneers': 'Buccaneers', 'vikings': 'Vikings',
        'bears': 'Bears', 'giants': 'Giants', 'washington': 'Commanders',

        // NBA Teams
        'lakers': 'Lakers', 'celtics': 'Celtics', 'warriors': 'Warriors', 'heat': 'Heat',
        'bulls': 'Bulls', 'knicks': 'Knicks', 'suns': 'Suns', 'mavericks': 'Mavericks',
        'bucks': 'Bucks', '76ers': '76ers', 'nets': 'Nets', 'clippers': 'Clippers',
        'nuggets': 'Nuggets', 'jazz': 'Jazz', 'trail blazers': 'Trail Blazers',
        'thunder': 'Thunder', 'pelicans': 'Pelicans', 'kings': 'Kings',
        'timberwolves': 'Timberwolves', 'rockets': 'Rockets', 'spurs': 'Spurs',
        'grizzlies': 'Grizzlies', 'magic': 'Magic', 'hawks': 'Hawks',
        'hornets': 'Hornets', 'pistons': 'Pistons', 'pacers': 'Pacers',
        'cavaliers': 'Cavaliers', 'raptors': 'Raptors', 'wizards': 'Wizards'
      };

      // Find teams in title
      for (const [pattern, name] of Object.entries(teamPatterns)) {
        if (title.includes(pattern) && !result.teams.includes(name)) {
          result.teams.push(name);
        }
      }

      // Parse tables for odds
      if (oddsData.tables && oddsData.tables.length > 0) {
        oddsData.tables.forEach((table: any) => {
          // Look for spread/moneyline/total table
          if (table.headers.some((h: string) => h.toLowerCase().includes('spread'))) {
            table.rows.forEach((row: any) => {
              if (row.length >= 4) {
                const team = row[0];
                const spread = row[1];
                const moneyline = row[2];
                const total = row[3];

                if (spread && spread !== 'Spread' && spread !== '') {
                  // Extract spread line and odds
                  const spreadMatch = spread.match(/([+-]\d+\.?\d*)\s*\(([+-]\d+)\)/);
                  if (spreadMatch) {
                    result.spread.push({
                      team: team,
                      line: spreadMatch[1],
                      odds: spreadMatch[2]
                    });
                    result.keyOdds.push({
                      type: 'Spread',
                      description: `${team} ${spreadMatch[1]}`,
                      value: spreadMatch[2]
                    });
                  }
                }

                if (moneyline && moneyline !== 'Moneyline' && moneyline !== '') {
                  result.moneyline.push({
                    team: team,
                    odds: moneyline
                  });
                  result.keyOdds.push({
                    type: 'Moneyline',
                    description: team,
                    value: moneyline
                  });
                }

                if (total && total !== 'Total' && total !== '') {
                  // Extract over/under from total
                  const totalMatch = total.match(/(\d+\.?\d*)/);
                  if (totalMatch) {
                    result.total = {
                      over: '(-110)', // Default odds
                      under: '(-110)', // Default odds
                      line: totalMatch[1]
                    };
                    result.keyOdds.push({
                      type: 'Total',
                      description: `O/U ${totalMatch[1]}`,
                      value: 'Over: (-110), Under: (-110)'
                    });
                  }
                }
              }
            });
          }

          // Look for fighter odds table
          if (table.headers.some((h: string) => h.toLowerCase().includes('fighter'))) {
            table.rows.forEach((row: any) => {
              if (row.length >= 2) {
                result.fighters.push({
                  name: row[0],
                  odds: row[1]
                });
              }
            });
          }

          // Look for player props table
          if (table.headers.some((h: string) => h.toLowerCase().includes('player'))) {
            table.rows.forEach((row: any) => {
              if (row.length >= 3) {
                result.playerProps.push({
                  player: row[0],
                  team: row[1],
                  prop: 'Points', // Default prop type
                  odds: row[2]
                });
              }
            });
          }
        });
      }

      // If no structured data found, try to extract from odds patterns
      if (result.moneyline.length === 0 && oddsData.odds && oddsData.odds.length >= 2) {
        const moneylines = oddsData.odds.filter((odd: string) =>
          /^[+-]\d{3,4}$/.test(odd) || /^[+-]\d{1,2}$/.test(odd)
        );
        if (moneylines.length >= 2) {
          // Try to associate moneyline values with teams
          if (result.teams.length >= 2) {
            result.moneyline.push(
              { team: result.teams[0] || 'Team 1', odds: moneylines[0] },
              { team: result.teams[1] || 'Team 2', odds: moneylines[1] }
            );
            result.keyOdds.push(
              { type: 'Moneyline', description: result.teams[0] || 'Team 1', value: moneylines[0] },
              { type: 'Moneyline', description: result.teams[1] || 'Team 2', value: moneylines[1] }
            );
          } else if (result.fighters.length >= 2) {
            result.moneyline.push(
              { team: (result.fighters[0] && result.fighters[0].name) || 'Fighter 1', odds: moneylines[0] },
              { team: (result.fighters[1] && result.fighters[1].name) || 'Fighter 2', odds: moneylines[1] }
            );
          } else if (result.playerProps.length >= 2) {
            result.moneyline.push(
              { team: (result.playerProps[0] && result.playerProps[0].player) || 'Player 1', odds: moneylines[0] },
              { team: (result.playerProps[1] && result.playerProps[1].player) || 'Player 2', odds: moneylines[1] }
            );
          } else {
            // Fallback to just the values if no names available
            result.moneyline.push(
              { team: 'Team 1', odds: moneylines[0] },
              { team: 'Team 2', odds: moneylines[1] }
            );
          }
        }
      }

    } catch (error) {
      logger.error('Error parsing odds data:', error);
    }

    return result;
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
