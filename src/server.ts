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
// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    message: 'Server is ready to process requests'
  });
});

// Status endpoint to check RSS files
app.get('/api/rss/status', (req, res) => {
  const fs = require('fs');
  const path = require('path');

  try {
    const files: Record<string, boolean> = {
      rss_puppeteer: fs.existsSync('rss_puppeteer.xml'),
      rss_decoded: fs.existsSync('rss_decoded.xml'),
      rss_parsed: fs.existsSync('rss_parsed.json'),
      rss_with_odds: fs.existsSync('rss_with_odds.json'),
      comprehensive_sports_data: fs.existsSync('comprehensive_sports_data.json'),
      ai_enhanced_sports_data: fs.existsSync('ai_enhanced_sports_data.json')
    };

    const stats: Record<string, any> = {};
    Object.keys(files).forEach(key => {
      if (files[key]) {
        const filePath = key === 'rss_puppeteer' ? 'rss_puppeteer.xml' :
                        key === 'rss_decoded' ? 'rss_decoded.xml' :
                        key === 'rss_parsed' ? 'rss_parsed.json' :
                        key === 'rss_with_odds' ? 'rss_with_odds.json' :
                        key === 'comprehensive_sports_data' ? 'comprehensive_sports_data.json' :
                        'ai_enhanced_sports_data.json';
        const stat = fs.statSync(filePath);
        stats[key] = {
          exists: true,
          size: stat.size,
          modified: stat.mtime.toISOString()
        };
      } else {
        stats[key] = { exists: false };
      }
    });

    res.json({
      status: 'RSS files status',
      timestamp: new Date().toISOString(),
      files: stats
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to check RSS files',
      details: errorMessage
    });
  }
});

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
    logger.info('Starting Puppeteer process...');

    // Immediately respond to the client
    res.json({
      success: true,
      message: 'Puppeteer process started successfully',
      note: 'Check terminal for progress. Use "Check RSS Status" button to see when files are ready.'
    });

    // Then start Puppeteer in the background
    const { spawn } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../puppeteer_rss.js');

    logger.info(`Executing script: ${scriptPath}`);

    // Use spawn without detaching so we can see output
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit', // This will show all output in the terminal
      windowsHide: false // Show console window on Windows
    });

    // Handle completion
    child.on('close', (code: number) => {
      logger.info(`Puppeteer process completed with code ${code}`);
      if (code === 0) {
        logger.info('✅ Puppeteer completed successfully');
      } else {
        logger.error(`❌ Puppeteer failed with code: ${code}`);
      }
    });

    // Handle errors
    child.on('error', (error: any) => {
      logger.error('Child process error:', error);
    });

  } catch (error) {
    logger.error('Failed to start Puppeteer:', error);
    // Don't send error response since we already sent success
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

// AI Analysis endpoint
app.get('/api/ai/analyze', async (req, res) => {
  try {
    logger.info('Starting AI analysis process...');

    // Immediately respond to the client
    res.json({
      success: true,
      message: 'AI analysis process started successfully',
      note: 'Check terminal for progress. This may take several minutes.'
    });

    // Then start AI analysis in the background
    const { spawn } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../ai_analysis_processor.js');

    logger.info(`Executing AI analysis script: ${scriptPath}`);

    // Use spawn without detaching so we can see output
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit', // This will show all output in the terminal
      windowsHide: false // Show console window on Windows
    });

    // Handle completion
    child.on('close', (code: number) => {
      logger.info(`AI analysis process completed with code ${code}`);
      if (code === 0) {
        logger.info('✅ AI analysis completed successfully');
      } else {
        logger.error(`❌ AI analysis failed with code: ${code}`);
      }
    });

    // Handle errors
    child.on('error', (error: any) => {
      logger.error('AI analysis child process error:', error);
    });

  } catch (error) {
    logger.error('Failed to start AI analysis:', error);
    // Don't send error response since we already sent success
  }
});

// Get AI-enhanced data
app.get('/api/ai/data', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const aiDataPath = path.join(__dirname, '../ai_enhanced_sports_data.json');

    if (!fs.existsSync(aiDataPath)) {
      return res.status(404).json({
        error: 'AI-enhanced data not found. Run AI analysis first.',
        note: 'Use /api/ai/analyze to start AI analysis'
      });
    }

    const aiData = JSON.parse(fs.readFileSync(aiDataPath, 'utf8'));
    return res.json(aiData);
  } catch (error) {
    logger.error('Failed to fetch AI-enhanced data:', error);
    return res.status(500).json({ error: 'Failed to fetch AI-enhanced data' });
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
