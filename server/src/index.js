import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { TradingEngine } from './trading-engine.js';
import { AgentManager } from './agents.js';
import { MarketData } from './market-data.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3005;

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '1kb' })); // Small payloads only

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests' } });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many admin requests' } });
app.use('/api/', apiLimiter);
app.use('/api/admin/', adminLimiter);

// Initialize systems
const marketData = new MarketData();
const tradingEngine = new TradingEngine();
const agentManager = new AgentManager(tradingEngine, marketData);

// Serve dashboard
app.use(express.static(path.join(__dirname, '..', '..', 'dashboard', 'dist')));

// ============ API ROUTES ============

// Get all agents with their portfolios
app.get('/api/agents', (req, res) => {
  const agents = agentManager.getAllAgents();
  res.json(agents);
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const leaderboard = await agentManager.getLeaderboard();
  res.json(leaderboard);
});

// Get specific agent details
app.get('/api/agents/:id', (req, res) => {
  const agent = agentManager.getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

// Get agent's trade history
app.get('/api/agents/:id/trades', (req, res) => {
  const trades = tradingEngine.getTradeHistory(req.params.id);
  res.json(trades);
});

// Get all recent trades
app.get('/api/trades', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const trades = tradingEngine.getAllTrades(limit);
  res.json(trades);
});

// Get market status
app.get('/api/market/status', (req, res) => {
  res.json({
    isOpen: marketData.isMarketOpen(),
    nextOpen: marketData.getNextMarketOpen(),
    nextClose: marketData.getNextMarketClose()
  });
});

// Get competition status
app.get('/api/competition', (req, res) => {
  res.json(agentManager.getCompetitionStatus());
});

// Get graveyard (eliminated agents)
app.get('/api/graveyard', (req, res) => {
  res.json(agentManager.getGraveyard());
});

// Get agent memory summary
app.get('/api/agents/:id/memory', (req, res) => {
  try {
    const summary = agentManager.memory.getMemorySummary(req.params.id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent's daily reflections
app.get('/api/agents/:id/reflections', (req, res) => {
  try {
    const reflections = agentManager.memory.getReflections(req.params.id, 14);
    res.json(reflections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily summary
app.get('/api/summary', (req, res) => {
  try {
    const summariesFile = path.join(__dirname, '..', 'data', 'daily-summaries.json');
    const summaries = JSON.parse(fs.readFileSync(summariesFile, 'utf8'));
    res.json(summaries);
  } catch {
    res.json([]);
  }
});

// Get stock quote
app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const quote = await marketData.getQuote(req.params.symbol.toUpperCase());
    res.json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Manual trigger for testing (admin only)
app.post('/api/admin/trigger-trading', async (req, res) => {
  if (req.query.key !== 'stockracer2025') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  await agentManager.runTradingRound();
  res.json({ ok: true, message: 'Trading round executed' });
});

// Manual elimination trigger (admin only)
app.post('/api/admin/trigger-elimination', async (req, res) => {
  if (req.query.key !== 'stockracer2025') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const result = await agentManager.runElimination();
  res.json(result);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', '..', 'dashboard', 'dist', 'index.html'));
});

// ============ SCHEDULED TASKS ============

// Quick market scan every 30 seconds during market hours
let scanRunning = false;
setInterval(async () => {
  if (!marketData.isMarketOpen() || scanRunning) return;
  scanRunning = true;
  try {
    await agentManager.runMarketScan();
  } catch (e) {
    console.error('[SCAN] Error:', e.message);
  }
  scanRunning = false;
}, 30000);

// Full deep analysis every 10 minutes (refreshes cached analysis)
cron.schedule('*/10 9-16 * * 1-5', async () => {
  if (marketData.isMarketOpen()) {
    console.log('[DEEP] Refreshing full market analysis...');
    await marketData.analyzeMultiple(marketData.getTradeableStocks());
  }
}, { timezone: 'America/New_York' });

// Daily summary at 5 PM ET
cron.schedule('0 17 * * 1-5', async () => {
  console.log('[CRON] Generating daily summary...');
  await agentManager.generateDailySummary();
}, { timezone: 'America/New_York' });

// Bi-weekly elimination check (every other Friday at 4:30 PM ET)
cron.schedule('30 16 * * 5', async () => {
  const status = agentManager.getCompetitionStatus();
  if (status.daysRemaining <= 0) {
    console.log('[CRON] Running elimination...');
    await agentManager.runElimination();
  }
}, { timezone: 'America/New_York' });

// ============ START SERVER ============

app.listen(PORT, () => {
  console.log(`🏎️  StockRacer running at http://localhost:${PORT}`);
  console.log(`📊 ${agentManager.getActiveAgentCount()} agents ready to trade`);
  
  // Initialize agents if needed
  agentManager.initialize();
});
