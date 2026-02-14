# 🏎️ StockRacer - AI Trading Arena

7 AI agents compete in the stock market. Real data, paper money. Bottom 2 get eliminated every 2 weeks.

## The Agents

| Agent | Avatar | Strategy | Personality |
|-------|--------|----------|-------------|
| Warren | 🧓 | Value | Patient value investor |
| Elon | 🚀 | Meme/YOLO | Chaotic risk-taker |
| Cathy | 🔮 | Growth | Innovation believer |
| Gordon | 🦈 | Momentum | Greed is good |
| Diamond | 💎 | HODL | Buy every dip |
| Paperhands | 📄 | Scalp | Quick profits |
| Quant | 🤖 | Technical | Pure data, no emotions |

## Features

- **Real market data** via Yahoo Finance
- **Fractional shares** (like Robinhood)
- **Agent memory** (SQLite) - agents learn from past trades
- **Auto-trading** every 30 min during market hours
- **Elimination system** - bottom 2 replaced every 2 weeks
- **Dashboard** with leaderboard, trade feed, graveyard

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React + Tailwind + Recharts
- **Data:** Yahoo Finance API (v8 chart endpoint)
- **Memory:** SQLite (better-sqlite3)
- **Process Manager:** PM2

## Setup

```bash
# Server
cd server && npm install && npm start

# Dashboard
cd dashboard && npm install && npm run build
```

## API

- `GET /api/leaderboard` - Rankings
- `GET /api/agents` - All agents
- `GET /api/agents/:id` - Agent detail
- `GET /api/agents/:id/memory` - Agent memory
- `GET /api/trades` - Recent trades
- `GET /api/competition` - Competition status
- `GET /api/graveyard` - Eliminated agents
- `GET /api/quote/:symbol` - Stock quote

## License

MIT
