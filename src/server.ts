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
app.use(helmet());
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
