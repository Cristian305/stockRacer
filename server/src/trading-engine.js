import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TRADES_FILE = path.join(DATA_DIR, 'trades.json');
const PORTFOLIOS_FILE = path.join(DATA_DIR, 'portfolios.json');

export class TradingEngine {
  constructor() {
    this.trades = this.loadTrades();
    this.portfolios = this.loadPortfolios();
  }

  loadTrades() {
    try {
      return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8'));
    } catch {
      return [];
    }
  }

  saveTrades() {
    fs.writeFileSync(TRADES_FILE, JSON.stringify(this.trades, null, 2));
  }

  loadPortfolios() {
    try {
      return JSON.parse(fs.readFileSync(PORTFOLIOS_FILE, 'utf8'));
    } catch {
      return {};
    }
  }

  savePortfolios() {
    fs.writeFileSync(PORTFOLIOS_FILE, JSON.stringify(this.portfolios, null, 2));
  }

  initializePortfolio(agentId, startingCash = 25) {
    if (!this.portfolios[agentId]) {
      this.portfolios[agentId] = {
        cash: startingCash,
        positions: {}, // { symbol: { shares: number, avgCost: number } }
        startingValue: startingCash,
        history: [{ timestamp: new Date().toISOString(), value: startingCash }]
      };
      this.savePortfolios();
    }
    return this.portfolios[agentId];
  }

  getPortfolio(agentId) {
    return this.portfolios[agentId] || null;
  }

  async executeBuy(agentId, symbol, shares, currentPrice) {
    const portfolio = this.portfolios[agentId];
    if (!portfolio) throw new Error('Portfolio not found');

    // Allow fractional shares (round to 4 decimal places)
    shares = Math.round(shares * 10000) / 10000;
    if (shares <= 0) return { success: false, error: 'Invalid share amount' };

    const cost = shares * currentPrice;
    const commission = 0; // Free trades like Robinhood

    if (portfolio.cash < cost + commission) {
      return { success: false, error: 'Insufficient funds' };
    }

    // Update cash
    portfolio.cash -= (cost + commission);

    // Update position
    if (!portfolio.positions[symbol]) {
      portfolio.positions[symbol] = { shares: 0, avgCost: 0 };
    }

    const position = portfolio.positions[symbol];
    const totalShares = position.shares + shares;
    const totalCost = (position.shares * position.avgCost) + cost;
    position.avgCost = totalCost / totalShares;
    position.shares = totalShares;

    // Record trade
    const trade = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      agentId,
      type: 'BUY',
      symbol,
      shares,
      price: currentPrice,
      total: cost,
      timestamp: new Date().toISOString()
    };
    this.trades.push(trade);

    this.savePortfolios();
    this.saveTrades();

    return { success: true, trade };
  }

  async executeSell(agentId, symbol, shares, currentPrice) {
    const portfolio = this.portfolios[agentId];
    if (!portfolio) throw new Error('Portfolio not found');

    const position = portfolio.positions[symbol];
    if (!position || position.shares < shares) {
      return { success: false, error: 'Insufficient shares' };
    }

    const proceeds = shares * currentPrice;
    const commission = 0;

    // Update cash
    portfolio.cash += (proceeds - commission);

    // Update position
    position.shares -= shares;
    if (position.shares === 0) {
      delete portfolio.positions[symbol];
    }

    // Calculate P&L
    const costBasis = shares * position.avgCost;
    const pnl = proceeds - costBasis;

    // Record trade
    const trade = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      agentId,
      type: 'SELL',
      symbol,
      shares,
      price: currentPrice,
      total: proceeds,
      pnl,
      timestamp: new Date().toISOString()
    };
    this.trades.push(trade);

    this.savePortfolios();
    this.saveTrades();

    return { success: true, trade, pnl };
  }

  async calculatePortfolioValue(agentId, marketData) {
    const portfolio = this.portfolios[agentId];
    if (!portfolio) return 0;

    let totalValue = portfolio.cash;

    for (const [symbol, position] of Object.entries(portfolio.positions)) {
      try {
        const quote = await marketData.getQuote(symbol);
        totalValue += position.shares * quote.price;
      } catch (error) {
        // Use last known price if quote fails
        totalValue += position.shares * position.avgCost;
      }
    }

    return totalValue;
  }

  recordPortfolioSnapshot(agentId, value) {
    const portfolio = this.portfolios[agentId];
    if (!portfolio) return;

    portfolio.history.push({
      timestamp: new Date().toISOString(),
      value
    });

    // Keep last 100 snapshots
    if (portfolio.history.length > 100) {
      portfolio.history = portfolio.history.slice(-100);
    }

    this.savePortfolios();
  }

  getTradeHistory(agentId, limit = 50) {
    return this.trades
      .filter(t => t.agentId === agentId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getAllTrades(limit = 50) {
    return this.trades
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getPerformance(agentId) {
    const portfolio = this.portfolios[agentId];
    if (!portfolio) return null;

    const startValue = portfolio.startingValue;
    const history = portfolio.history;
    const currentValue = history.length > 0 ? history[history.length - 1].value : startValue;

    const totalReturn = currentValue - startValue;
    const totalReturnPercent = ((currentValue - startValue) / startValue) * 100;

    // Calculate daily returns
    const dailyReturns = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].value;
      const curr = history[i].value;
      dailyReturns.push(((curr - prev) / prev) * 100);
    }

    return {
      startValue,
      currentValue,
      totalReturn,
      totalReturnPercent,
      dailyReturns,
      tradesCount: this.trades.filter(t => t.agentId === agentId).length
    };
  }

  resetPortfolio(agentId, startingCash = 25) {
    this.portfolios[agentId] = {
      cash: startingCash,
      positions: {},
      startingValue: startingCash,
      history: [{ timestamp: new Date().toISOString(), value: startingCash }]
    };
    this.savePortfolios();
  }

  deletePortfolio(agentId) {
    delete this.portfolios[agentId];
    this.savePortfolios();
  }
}
