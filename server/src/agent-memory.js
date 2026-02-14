import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'agent-memory.db');

export class AgentMemory {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  initialize() {
    this.db.exec(`
      -- Trade outcomes: what worked, what didn't
      CREATE TABLE IF NOT EXISTS trade_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL,
        entry_price REAL,
        exit_price REAL,
        pnl REAL,
        pnl_percent REAL,
        hold_duration_hours REAL,
        market_condition TEXT,
        reason TEXT,
        lesson TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Market observations: patterns agents noticed
      CREATE TABLE IF NOT EXISTS market_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        symbol TEXT,
        observation TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        validated INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Agent beliefs: learned preferences and biases
      CREATE TABLE IF NOT EXISTS agent_beliefs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        belief_type TEXT NOT NULL,
        symbol TEXT,
        value REAL,
        note TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(agent_id, belief_type, symbol)
      );

      -- Daily reflections: agent's end-of-day thoughts
      CREATE TABLE IF NOT EXISTS daily_reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        date TEXT NOT NULL,
        portfolio_value REAL,
        trades_made INTEGER,
        reflection TEXT,
        mood TEXT,
        strategy_adjustment TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(agent_id, date)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_trade_outcomes_agent ON trade_outcomes(agent_id);
      CREATE INDEX IF NOT EXISTS idx_trade_outcomes_symbol ON trade_outcomes(symbol);
      CREATE INDEX IF NOT EXISTS idx_observations_agent ON market_observations(agent_id);
      CREATE INDEX IF NOT EXISTS idx_beliefs_agent ON agent_beliefs(agent_id);
    `);
  }

  // Record a trade outcome with learned lesson
  recordTradeOutcome(agentId, { symbol, action, entryPrice, exitPrice, pnl, pnlPercent, holdDurationHours, marketCondition, reason, lesson }) {
    const stmt = this.db.prepare(`
      INSERT INTO trade_outcomes (agent_id, symbol, action, entry_price, exit_price, pnl, pnl_percent, hold_duration_hours, market_condition, reason, lesson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(agentId, symbol, action, entryPrice, exitPrice, pnl, pnlPercent, holdDurationHours, marketCondition, reason, lesson);
  }

  // Get agent's past trades for a symbol
  getTradeHistory(agentId, symbol = null, limit = 20) {
    if (symbol) {
      return this.db.prepare(`
        SELECT * FROM trade_outcomes WHERE agent_id = ? AND symbol = ? ORDER BY created_at DESC LIMIT ?
      `).all(agentId, symbol, limit);
    }
    return this.db.prepare(`
      SELECT * FROM trade_outcomes WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(agentId, limit);
  }

  // Get agent's win rate for a symbol
  getWinRate(agentId, symbol = null) {
    const where = symbol ? 'agent_id = ? AND symbol = ?' : 'agent_id = ?';
    const params = symbol ? [agentId, symbol] : [agentId];
    
    const result = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
        AVG(pnl_percent) as avg_return,
        AVG(CASE WHEN pnl > 0 THEN pnl_percent ELSE NULL END) as avg_win,
        AVG(CASE WHEN pnl < 0 THEN pnl_percent ELSE NULL END) as avg_loss
      FROM trade_outcomes WHERE ${where}
    `).get(...params);

    return {
      ...result,
      winRate: result.total > 0 ? (result.wins / result.total) * 100 : 0
    };
  }

  // Record a market observation
  addObservation(agentId, { symbol, observation, confidence }) {
    const stmt = this.db.prepare(`
      INSERT INTO market_observations (agent_id, symbol, observation, confidence)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(agentId, symbol, observation, confidence || 0.5);
  }

  // Get recent observations
  getObservations(agentId, limit = 10) {
    return this.db.prepare(`
      SELECT * FROM market_observations WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(agentId, limit);
  }

  // Update or create an agent belief (e.g., "I like AAPL", "momentum is hot")
  updateBelief(agentId, { beliefType, symbol, value, note }) {
    const stmt = this.db.prepare(`
      INSERT INTO agent_beliefs (agent_id, belief_type, symbol, value, note, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(agent_id, belief_type, symbol) DO UPDATE SET
        value = excluded.value,
        note = excluded.note,
        updated_at = datetime('now')
    `);
    stmt.run(agentId, beliefType, symbol || '_general', value, note);
  }

  // Get agent's beliefs
  getBeliefs(agentId, beliefType = null) {
    if (beliefType) {
      return this.db.prepare(`
        SELECT * FROM agent_beliefs WHERE agent_id = ? AND belief_type = ? ORDER BY updated_at DESC
      `).all(agentId, beliefType);
    }
    return this.db.prepare(`
      SELECT * FROM agent_beliefs WHERE agent_id = ? ORDER BY updated_at DESC
    `).all(agentId);
  }

  // Get belief score for a specific stock (how much an agent "likes" it)
  getStockSentiment(agentId, symbol) {
    const belief = this.db.prepare(`
      SELECT value FROM agent_beliefs WHERE agent_id = ? AND belief_type = 'stock_sentiment' AND symbol = ?
    `).get(agentId, symbol);
    return belief ? belief.value : 0; // -1 to 1 scale
  }

  // Record daily reflection
  addDailyReflection(agentId, { portfolioValue, tradesMade, reflection, mood, strategyAdjustment }) {
    const date = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      INSERT INTO daily_reflections (agent_id, date, portfolio_value, trades_made, reflection, mood, strategy_adjustment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, date) DO UPDATE SET
        portfolio_value = excluded.portfolio_value,
        trades_made = excluded.trades_made,
        reflection = excluded.reflection,
        mood = excluded.mood,
        strategy_adjustment = excluded.strategy_adjustment
    `);
    stmt.run(agentId, date, portfolioValue, tradesMade, reflection, mood, strategyAdjustment);
  }

  // Get agent's recent reflections
  getReflections(agentId, limit = 7) {
    return this.db.prepare(`
      SELECT * FROM daily_reflections WHERE agent_id = ? ORDER BY date DESC LIMIT ?
    `).all(agentId, limit);
  }

  // Get best performing stocks for an agent
  getBestStocks(agentId, limit = 5) {
    return this.db.prepare(`
      SELECT symbol, 
        COUNT(*) as trades,
        AVG(pnl_percent) as avg_return,
        SUM(pnl) as total_pnl,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
      FROM trade_outcomes 
      WHERE agent_id = ?
      GROUP BY symbol
      HAVING trades >= 2
      ORDER BY avg_return DESC
      LIMIT ?
    `).all(agentId, limit);
  }

  // Get worst performing stocks for an agent
  getWorstStocks(agentId, limit = 5) {
    return this.db.prepare(`
      SELECT symbol,
        COUNT(*) as trades,
        AVG(pnl_percent) as avg_return,
        SUM(pnl) as total_pnl,
        SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses
      FROM trade_outcomes
      WHERE agent_id = ?
      GROUP BY symbol
      HAVING trades >= 2
      ORDER BY avg_return ASC
      LIMIT ?
    `).all(agentId, limit);
  }

  // Clear memory for eliminated agent (fresh start for new generation)
  clearAgentMemory(agentId) {
    this.db.prepare('DELETE FROM trade_outcomes WHERE agent_id = ?').run(agentId);
    this.db.prepare('DELETE FROM market_observations WHERE agent_id = ?').run(agentId);
    this.db.prepare('DELETE FROM agent_beliefs WHERE agent_id = ?').run(agentId);
    this.db.prepare('DELETE FROM daily_reflections WHERE agent_id = ?').run(agentId);
  }

  // Get full agent memory summary (for decision making context)
  getMemorySummary(agentId) {
    const winRate = this.getWinRate(agentId);
    const bestStocks = this.getBestStocks(agentId, 3);
    const worstStocks = this.getWorstStocks(agentId, 3);
    const recentTrades = this.getTradeHistory(agentId, null, 5);
    const beliefs = this.getBeliefs(agentId);
    const reflections = this.getReflections(agentId, 3);

    return {
      winRate,
      bestStocks,
      worstStocks,
      recentTrades,
      beliefs,
      reflections
    };
  }

  close() {
    this.db.close();
  }
}
