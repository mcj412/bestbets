import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import rssFeedAgent from './agents/rssFeed.agent';
import sportsApiAgent from './agents/sportsApi.agent';
import config from './utils/config';
import logger from './utils/logger';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/sports', async (req, res) => {
  try {
    const sports = await sportsApiAgent.getAvailableSports();
    res.json(sports);
  } catch (error) {
    logger.error('Failed to fetch sports:', error);
    res.status(500).json({ error: 'Failed to fetch sports' });
  }
});

app.get('/api/games/:sportKey?', async (req, res) => {
  try {
    const sportKey = req.params.sportKey || 'basketball_nba';
    const games = await sportsApiAgent.getGames(sportKey);
    res.json(games);
  } catch (error) {
    logger.error('Failed to fetch games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.get('/api/schedule/:sportKey?', async (req, res) => {
  try {
    const sportKey = req.params.sportKey || 'basketball_nba';
    const schedule = await sportsApiAgent.getLeagueSchedule(sportKey);
    res.json(schedule);
  } catch (error) {
    logger.error('Failed to fetch league schedule:', error);
    res.status(500).json({ error: 'Failed to fetch league schedule' });
  }
});

app.get('/api/odds/:sportKey?', async (req, res) => {
  try {
    const sportKey = req.params.sportKey || 'basketball_nba';
    const odds = await sportsApiAgent.getOdds(sportKey);
    res.json(odds);
  } catch (error) {
    logger.error('Failed to fetch odds:', error);
    res.status(500).json({ error: 'Failed to fetch odds' });
  }
});

// RSS Feed Routes
app.get('/api/rss/feed', async (req, res) => {
  try {
    const feedData = await rssFeedAgent.getRSSFeed();
    res.json(feedData);
  } catch (error) {
    logger.error('Failed to fetch RSS feed:', error);
    res.status(500).json({ error: 'Failed to fetch RSS feed' });
  }
});

app.get('/api/rss/save-to-file', async (req, res) => {
  try {
    await rssFeedAgent.saveRSSFeedToFile();
    res.json({ success: true, message: 'RSS feed content saved to file' });
  } catch (error) {
    logger.error('Failed to save RSS feed to file:', error);
    res.status(500).json({ error: 'Failed to save RSS feed to file' });
  }
});

app.get('/api/rss/update', async (req, res) => {
  try {
    logger.info('Running standalone Puppeteer script to pull RSS data...');

    // Run the standalone puppeteer_rss.js script
    const { exec } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../puppeteer_rss.js');

    exec(`node "${scriptPath}"`, (error: any, stdout: any, stderr: any) => {
      if (error) {
        logger.error('Error running Puppeteer script:', error);
        res.status(500).json({ error: 'Failed to run Puppeteer script' });
        return;
      }

      if (stderr) {
        logger.warn('Puppeteer script stderr:', stderr);
      }

      logger.info('Puppeteer script output:', stdout);
      logger.info('RSS feed updated successfully');

      res.json({ success: true, message: 'RSS feed updated successfully' });
    });

  } catch (error) {
    logger.error('Failed to update RSS feed:', error);
    res.status(500).json({ error: 'Failed to update RSS feed' });
  }
});

app.get('/api/rss/games', async (req, res) => {
  try {
    const games = await rssFeedAgent.getGamesFromRSS();
    res.json(games);
  } catch (error) {
    logger.error('Failed to fetch games from RSS:', error);
    res.status(500).json({ error: 'Failed to fetch games from RSS' });
  }
});

app.get('/api/rss/schedule/:sportKey?', async (req, res) => {
  try {
    const sportKey = req.params.sportKey || 'basketball_nba';
    const schedule = await rssFeedAgent.getLeagueScheduleFromRSS(sportKey);
    res.json(schedule);
  } catch (error) {
    logger.error('Failed to fetch RSS schedule:', error);
    res.status(500).json({ error: 'Failed to fetch RSS schedule' });
  }
});

// Serve the main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = config.server.port;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Dashboard available at http://localhost:${PORT}`);
  logger.info(`API available at http://localhost:${PORT}/api`);
});

export default app;
