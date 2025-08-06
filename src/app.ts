import './server'; // This will start the Express server
import dbService from './services/db.service';
import logger from './utils/logger';

async function bootstrap() {
  try {
    logger.info('Starting IonoI Bets application...');

    // Try to initialize database connection (optional)
    try {
      await dbService.connect();
      await dbService.initializeTables();
      logger.info('Database connected successfully');
    } catch (dbError) {
      logger.warn('Database connection failed, running without database:', dbError);
    }

    logger.info('Application started successfully');
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await dbService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await dbService.close();
  process.exit(0);
});

// Start the application
bootstrap();
