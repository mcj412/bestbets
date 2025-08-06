# IonoI Bets - Sports Odds Detection System

A real-time sports odds monitoring and advantage detection system built with Node.js, TypeScript, and PostgreSQL.

## 🚀 Quick Start (MVP)

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis (optional for MVP)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
       cd ionoi-bets
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=advantage_z
   DB_USER=postgres
   DB_PASSWORD=your_password

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Optional: Sports API Key (get free key from https://the-odds-api.com/)
   SPORTS_API_KEY=your_api_key_here
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb advantage_z

   # Or using psql
   psql -U postgres
   CREATE DATABASE advantage_z;
   \q
   ```

5. **Start the application**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Or production mode
   npm run build
   npm start
   ```

6. **Access the dashboard**
   Open your browser and go to: http://localhost:3000

## 📊 Features

### MVP Features
- ✅ Real-time sports data fetching
- ✅ Beautiful web dashboard
- ✅ Multiple sports support (NBA, NFL, MLB)
- ✅ Database storage for games and odds
- ✅ API endpoints for data access
- ✅ Fallback to mock data when API unavailable

### Upcoming Features
- 🔄 Multi-site odds comparison
- 🔄 Advantage detection algorithms
- 🔄 Telegram/Discord alerts
- 🔄 Advanced filtering and search
- 🔄 Historical data analysis

## 🏗️ Architecture

```
src/
├── agents/           # Data extraction agents
├── services/         # Core business logic
├── models/          # Database models and schemas
├── utils/           # Utilities and configuration
└── server.ts        # Express web server
```

## 🔧 API Endpoints

### Health Check
- `GET /api/health` - Application status

### Sports Data
- `GET /api/sports` - Available sports
- `GET /api/games/:sportKey` - Games for a sport
- `GET /api/odds/:sportKey` - Odds for a sport

### Examples
```bash
# Get NBA games
curl http://localhost:3000/api/games/basketball_nba

# Get NFL odds
curl http://localhost:3000/api/odds/americanfootball_nfl
```

## 🎯 Usage

1. **Load the dashboard** - Visit http://localhost:3000
2. **Select a sport** - Choose from NBA, NFL, or MLB
3. **Load games** - Click "Load Games" to fetch current games
4. **Load odds** - Click "Load Odds" to fetch betting odds
5. **Refresh data** - Use "Refresh All" to update everything

## 🔑 Getting API Keys

For real sports data, get a free API key from:
- [The Odds API](https://the-odds-api.com/) - Free tier available

## 🛠️ Development

### Available Scripts
```bash
npm run dev      # Start development server with auto-reload
npm run build    # Build for production
npm run start    # Start production server
npm run test     # Run tests
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
```

### Project Structure
```
ionoi-bets/
├── src/
│   ├── agents/          # Data extraction
│   ├── services/        # Business logic
│   ├── models/         # Database models
│   ├── utils/          # Utilities
│   ├── app.ts          # Main entry point
│   └── server.ts       # Web server
├── public/             # Static files
├── logs/              # Application logs
└── dist/              # Built files
```

## 🚨 Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check PostgreSQL is running
   - Verify database credentials in `.env`
   - Ensure database `advantage_z` exists

2. **API errors**
   - Check your API key is valid
   - Verify internet connection
   - System will fallback to mock data

3. **Port already in use**
   - Change PORT in `.env` file
   - Or kill process using port 3000

### Logs
Check application logs in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

## 📈 Next Steps

This MVP provides the foundation. Next development phases will add:

1. **Multi-site scraping** - Compare odds across multiple bookmakers
2. **Advantage detection** - Identify profitable betting opportunities
3. **Alert system** - Real-time notifications via Telegram/Discord
4. **Advanced analytics** - Historical data and trend analysis
5. **Production deployment** - Docker containers and cloud hosting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Note**: This is an MVP version. For production use, additional security, monitoring, and scalability features should be implemented.
