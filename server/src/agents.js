import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TRADEABLE_STOCKS } from './market-data.js';
import { AgentMemory } from './agent-memory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const GRAVEYARD_FILE = path.join(DATA_DIR, 'graveyard.json');
const COMPETITION_FILE = path.join(DATA_DIR, 'competition.json');

// Agent personality definitions
const AGENT_TEMPLATES = {
  warren: {
    name: 'Warren',
    personality: 'Patient value investor',
    avatar: '🧓',
    color: '#2563eb',
    strategy: 'value',
    riskTolerance: 0.3,
    tradeFrequency: 0.3, // Less frequent trades
    preferredStocks: ['JNJ', 'KO', 'PG', 'JPM', 'BAC', 'WMT', 'XOM', 'CVX'],
    avoidStocks: ['GME', 'AMC', 'RIVN', 'LCID']
  },
  elon: {
    name: 'Elon',
    personality: 'Chaotic risk-taker, YOLO energy',
    avatar: '🚀',
    color: '#dc2626',
    strategy: 'meme',
    riskTolerance: 0.9,
    tradeFrequency: 0.85,
    preferredStocks: ['TSLA', 'GME', 'AMC', 'PLTR', 'NVDA'],
    avoidStocks: []
  },
  cathy: {
    name: 'Cathy',
    personality: 'Innovation believer, disruption focused',
    avatar: '🔮',
    color: '#7c3aed',
    strategy: 'growth',
    riskTolerance: 0.7,
    tradeFrequency: 0.6,
    preferredStocks: ['TSLA', 'SHOP', 'NET', 'PLTR', 'NVDA', 'CRM'],
    avoidStocks: ['XOM', 'CVX', 'KO']
  },
  gordon: {
    name: 'Gordon',
    personality: 'Greed is good, aggressive momentum',
    avatar: '🦈',
    color: '#059669',
    strategy: 'momentum',
    riskTolerance: 0.8,
    tradeFrequency: 0.7,
    preferredStocks: [], // Chases whatever is hot
    avoidStocks: []
  },
  diamond: {
    name: 'Diamond',
    personality: '💎🙌 Never sells, buys every dip',
    avatar: '💎',
    color: '#0ea5e9',
    strategy: 'hodl',
    riskTolerance: 0.6,
    tradeFrequency: 0.2, // Rarely trades, just holds
    preferredStocks: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN'],
    avoidStocks: []
  },
  paperhands: {
    name: 'Paperhands',
    personality: 'Quick profits, tight stop-losses',
    avatar: '📄',
    color: '#f59e0b',
    strategy: 'scalp',
    riskTolerance: 0.2,
    tradeFrequency: 0.9,
    preferredStocks: [], // Trades whatever
    avoidStocks: ['GME', 'AMC'] // Too scary
  },
  quant: {
    name: 'Quant',
    personality: 'Pure data, no emotions',
    avatar: '🤖',
    color: '#6366f1',
    strategy: 'technical',
    riskTolerance: 0.5,
    tradeFrequency: 0.6,
    preferredStocks: [], // Data-driven
    avoidStocks: []
  }
};

export class AgentManager {
  constructor(tradingEngine, marketData) {
    this.tradingEngine = tradingEngine;
    this.marketData = marketData;
    this.memory = new AgentMemory();
    this.agents = this.loadAgents();
    this.graveyard = this.loadGraveyard();
    this.competition = this.loadCompetition();
  }

  loadAgents() {
    try {
      return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    } catch {
      return {};
    }
  }

  saveAgents() {
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(this.agents, null, 2));
  }

  loadGraveyard() {
    try {
      return JSON.parse(fs.readFileSync(GRAVEYARD_FILE, 'utf8'));
    } catch {
      return [];
    }
  }

  saveGraveyard() {
    fs.writeFileSync(GRAVEYARD_FILE, JSON.stringify(this.graveyard, null, 2));
  }

  loadCompetition() {
    try {
      return JSON.parse(fs.readFileSync(COMPETITION_FILE, 'utf8'));
    } catch {
      return {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        round: 1,
        eliminated: []
      };
    }
  }

  saveCompetition() {
    fs.writeFileSync(COMPETITION_FILE, JSON.stringify(this.competition, null, 2));
  }

  initialize() {
    // Create all 7 agents if they don't exist
    const templateIds = Object.keys(AGENT_TEMPLATES);
    
    for (const templateId of templateIds) {
      if (!this.agents[templateId]) {
        this.createAgent(templateId);
      } else {
        // Ensure portfolio exists for existing agents
        this.tradingEngine.initializePortfolio(templateId, 25);
      }
    }
    
    console.log(`[AgentManager] Initialized ${Object.keys(this.agents).length} agents`);
  }

  createAgent(templateId, generation = 1) {
    const template = AGENT_TEMPLATES[templateId];
    if (!template) throw new Error(`Unknown agent template: ${templateId}`);

    const agent = {
      id: templateId,
      ...template,
      generation,
      createdAt: new Date().toISOString(),
      status: 'active',
      kills: 0 // How many agents this one has outlasted
    };

    this.agents[templateId] = agent;
    this.tradingEngine.initializePortfolio(templateId, 25);
    this.saveAgents();

    console.log(`[AgentManager] Created agent: ${agent.name} (Gen ${generation})`);
    return agent;
  }

  getAgent(agentId) {
    const agent = this.agents[agentId];
    if (!agent) return null;

    const portfolio = this.tradingEngine.getPortfolio(agentId);
    const performance = this.tradingEngine.getPerformance(agentId);

    return { ...agent, portfolio, performance };
  }

  getAllAgents() {
    const result = [];
    for (const agentId of Object.keys(this.agents)) {
      result.push(this.getAgent(agentId));
    }
    return result;
  }

  getActiveAgentCount() {
    return Object.values(this.agents).filter(a => a.status === 'active').length;
  }

  async getLeaderboard() {
    const agents = [];
    
    for (const agentId of Object.keys(this.agents)) {
      const agent = this.agents[agentId];
      if (agent.status !== 'active') continue;

      const value = await this.tradingEngine.calculatePortfolioValue(agentId, this.marketData);
      const performance = this.tradingEngine.getPerformance(agentId);

      agents.push({
        id: agentId,
        name: agent.name,
        avatar: agent.avatar,
        color: agent.color,
        personality: agent.personality,
        currentValue: value,
        totalReturn: value - 25,
        totalReturnPercent: ((value - 25) / 25) * 100,
        tradesCount: performance?.tradesCount || 0,
        generation: agent.generation
      });
    }

    // Sort by value (highest first)
    agents.sort((a, b) => b.currentValue - a.currentValue);

    // Add rank
    agents.forEach((agent, index) => {
      agent.rank = index + 1;
      agent.isElimination = index >= agents.length - 2; // Bottom 2 in danger
    });

    return agents;
  }

  async runTradingRound() {
    console.log('[Trading] Starting trading round...');
    
    // Get market data AND analysis for all tradeable stocks
    const quotes = await this.marketData.getMultipleQuotes(TRADEABLE_STOCKS);
    const analyses = await this.marketData.analyzeMultiple(TRADEABLE_STOCKS);
    const movers = await this.marketData.getTopMovers();

    for (const agentId of Object.keys(this.agents)) {
      const agent = this.agents[agentId];
      if (agent.status !== 'active') continue;

      try {
        await this.executeAgentStrategy(agent, quotes, movers, analyses);
        
        // Record portfolio snapshot
        const value = await this.tradingEngine.calculatePortfolioValue(agentId, this.marketData);
        this.tradingEngine.recordPortfolioSnapshot(agentId, value);
      } catch (error) {
        console.error(`[Trading] Error for ${agent.name}:`, error.message);
      }
    }

    console.log('[Trading] Trading round complete');
  }

  async executeAgentStrategy(agent, quotes, movers, analyses) {
    const portfolio = this.tradingEngine.getPortfolio(agent.id);
    if (!portfolio) return;

    // Decide if agent will trade this round (personality-based)
    if (Math.random() > agent.tradeFrequency) {
      return; // Skip this round
    }

    // Every agent first checks existing positions for sells
    await this.checkPositions(agent, portfolio, quotes, analyses);

    switch (agent.strategy) {
      case 'value':
        await this.strategyValue(agent, portfolio, quotes, analyses);
        break;
      case 'meme':
        await this.strategyMeme(agent, portfolio, quotes, analyses);
        break;
      case 'growth':
        await this.strategyGrowth(agent, portfolio, quotes, analyses);
        break;
      case 'momentum':
        await this.strategyMomentum(agent, portfolio, quotes, movers, analyses);
        break;
      case 'hodl':
        await this.strategyHodl(agent, portfolio, quotes, analyses);
        break;
      case 'scalp':
        await this.strategyScalp(agent, portfolio, quotes, analyses);
        break;
      case 'technical':
        await this.strategyTechnical(agent, portfolio, quotes, analyses);
        break;
    }
  }

  // Universal position checker - all agents review their holdings
  async checkPositions(agent, portfolio, quotes, analyses) {
    for (const [symbol, position] of Object.entries(portfolio.positions)) {
      if (!quotes[symbol]) continue;
      const currentPrice = quotes[symbol].price;
      const pnlPercent = ((currentPrice - position.avgCost) / position.avgCost) * 100;
      const analysis = analyses[symbol];

      // Check memory: how have we done with this stock?
      const sentiment = this.memory.getStockSentiment(agent.id, symbol);
      
      let shouldSell = false;
      let reason = '';

      // Strategy-specific sell thresholds
      switch (agent.strategy) {
        case 'scalp':
          if (pnlPercent > 1.5 || pnlPercent < -1.5) { shouldSell = true; reason = pnlPercent > 0 ? 'Quick profit' : 'Quick stop-loss'; }
          break;
        case 'momentum':
          if (pnlPercent < -3) { shouldSell = true; reason = 'Momentum loss cut'; }
          if (analysis && analysis.trend === 'bearish' && pnlPercent < 0) { shouldSell = true; reason = 'Trend reversal'; }
          break;
        case 'value':
          if (pnlPercent > 8) { shouldSell = true; reason = 'Value target reached'; }
          if (pnlPercent < -7) { shouldSell = true; reason = 'Value thesis broken'; }
          break;
        case 'hodl':
          // Diamond almost never sells
          if (pnlPercent < -15) { shouldSell = true; reason = 'Even diamond hands have limits'; }
          break;
        case 'meme':
          // Chaotic - sometimes panic sells
          if (pnlPercent < -5 && Math.random() > 0.5) { shouldSell = true; reason = 'Panic sell!'; }
          if (pnlPercent > 10) { shouldSell = true; reason = 'Taking tendies 🍗'; }
          break;
        case 'growth':
          if (pnlPercent < -8) { shouldSell = true; reason = 'Growth story broken'; }
          if (analysis && analysis.rsi > 80) { shouldSell = true; reason = 'Overbought - take profits'; }
          break;
        case 'technical':
          if (analysis && analysis.rsi > 70 && pnlPercent > 0) { shouldSell = true; reason = 'RSI overbought signal'; }
          if (analysis && analysis.signal < -30) { shouldSell = true; reason = 'Strong sell signal'; }
          if (pnlPercent < -5) { shouldSell = true; reason = 'Technical stop-loss'; }
          break;
      }

      // Memory check: if sentiment is very negative, more likely to sell
      if (sentiment < -0.5 && pnlPercent < 0) {
        shouldSell = true;
        reason = 'Bad history with this stock';
      }

      if (shouldSell && position.shares > 0) {
        const result = await this.tradingEngine.executeSell(agent.id, symbol, position.shares, currentPrice);
        if (result.success) {
          this.memory.recordTradeOutcome(agent.id, {
            symbol, action: 'SELL', entryPrice: position.avgCost, exitPrice: currentPrice,
            pnl: result.pnl, pnlPercent, reason,
            lesson: pnlPercent > 0 ? `${symbol} was a winner - ${reason}` : `${symbol} was a loser - ${reason}`
          });
          this.memory.updateBelief(agent.id, {
            beliefType: 'stock_sentiment', symbol,
            value: Math.max(-1, Math.min(1, sentiment + (pnlPercent > 0 ? 0.2 : -0.3))),
            note: `Sold at ${pnlPercent.toFixed(1)}%: ${reason}`
          });
          console.log(`[${agent.name}] SELL ${position.shares} ${symbol} @ $${currentPrice.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(1)}%) - ${reason}`);
        }
      }
    }
  }

  // Strategy: Value investing - buys stable stocks with good fundamentals on dips
  async strategyValue(agent, portfolio, quotes, analyses) {
    const worstStocks = this.memory.getWorstStocks(agent.id, 5).map(s => s.symbol);
    
    const candidates = agent.preferredStocks
      .filter(s => quotes[s] && analyses[s])
      .filter(s => !agent.avoidStocks.includes(s))
      .filter(s => !worstStocks.includes(s))
      .map(s => ({ symbol: s, ...analyses[s], sentiment: this.memory.getStockSentiment(agent.id, s) }));

    // Warren looks for: low RSI (oversold), bearish/neutral trend (buy the dip), low volatility
    const scored = candidates.map(c => ({
      ...c,
      score: (c.rsi < 40 ? 30 : c.rsi < 50 ? 15 : -10) +
             (c.trend === 'bearish' ? 20 : c.trend === 'neutral' ? 10 : -5) + // Buy when others are fearful
             (c.volatility < 2 ? 15 : c.volatility < 3 ? 5 : -10) +
             (c.signal > 0 ? c.signal * 0.3 : 0) +
             (c.sentiment > 0 ? c.sentiment * 15 : c.sentiment * 10) +
             (c.dailyChange < -1 ? 20 : 0) // Buy on red days
    })).sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score > 10 && portfolio.cash > 1) {
      const pick = scored[0];
      const shares = Math.round((portfolio.cash * 0.3) / pick.price * 10000) / 10000;
      if (shares > 0) {
        const result = await this.tradingEngine.executeBuy(agent.id, pick.symbol, shares, pick.price);
        if (result.success) {
          this.memory.addObservation(agent.id, {
            symbol: pick.symbol,
            observation: `Bought at $${pick.price.toFixed(2)} | RSI:${pick.rsi.toFixed(0)} trend:${pick.trend} signal:${pick.signal.toFixed(0)} | Score:${pick.score.toFixed(0)}`,
            confidence: Math.min(0.9, pick.score / 100)
          });
          console.log(`[${agent.name}] 🧓 Value buy: ${shares} ${pick.symbol} @ $${pick.price.toFixed(2)} (RSI:${pick.rsi.toFixed(0)}, score:${pick.score.toFixed(0)})`);
        }
      }
    } else if (scored.length > 0) {
      console.log(`[${agent.name}] 🧓 Waiting... best score: ${scored[0].symbol} (${scored[0].score.toFixed(0)}) - not compelling enough`);
    }
  }

  // Strategy: Meme/YOLO - high risk, follows hype, buys volatile stocks
  async strategyMeme(agent, portfolio, quotes, analyses) {
    const memeStocks = agent.preferredStocks
      .filter(s => quotes[s] && analyses[s])
      .map(s => ({ symbol: s, ...analyses[s] }));

    // Elon loves: high volatility, big moves, momentum
    const scored = memeStocks.map(c => ({
      ...c,
      score: (c.volatility > 3 ? 30 : c.volatility > 2 ? 15 : 0) + // Love volatility
             (Math.abs(c.dailyChange) > 3 ? 25 : Math.abs(c.dailyChange) > 1 ? 10 : 0) + // Big moves
             (c.weekChange > 5 ? 20 : c.weekChange < -5 ? 15 : 0) + // Either direction = excitement
             (Math.random() * 30) // Chaos factor 🎲
    })).sort((a, b) => b.score - a.score);

    if (scored.length > 0 && portfolio.cash > 1) {
      const pick = scored[0];
      // YOLO sizing: 30-80% of cash
      const sizePct = 0.3 + Math.random() * 0.5;
      const shares = Math.round((portfolio.cash * sizePct) / pick.price * 10000) / 10000;
      
      if (shares > 0) {
        const result = await this.tradingEngine.executeBuy(agent.id, pick.symbol, shares, pick.price);
        if (result.success) {
          this.memory.addObservation(agent.id, {
            symbol: pick.symbol,
            observation: `🚀 YOLO @ $${pick.price.toFixed(2)} | vol:${pick.volatility.toFixed(1)}% daily:${pick.dailyChange.toFixed(1)}% | CHAOS SCORE: ${pick.score.toFixed(0)}`,
            confidence: 0.4
          });
          console.log(`[${agent.name}] 🚀 YOLO ${shares} ${pick.symbol} @ $${pick.price.toFixed(2)} (vol:${pick.volatility.toFixed(1)}%, chaos:${pick.score.toFixed(0)})`);
        }
      }
    }
  }

  // Strategy: Growth - buys innovation stocks in uptrends
  async strategyGrowth(agent, portfolio, quotes, analyses) {
    const growthStocks = agent.preferredStocks
      .filter(s => quotes[s] && analyses[s] && !agent.avoidStocks.includes(s))
      .map(s => ({ symbol: s, ...analyses[s], sentiment: this.memory.getStockSentiment(agent.id, s) }));

    // Cathy looks for: bullish trend, above moving averages, positive momentum
    const scored = growthStocks.map(c => ({
      ...c,
      score: (c.trend === 'bullish' ? 30 : c.trend === 'neutral' ? 5 : -20) +
             (c.aboveWeekAvg ? 15 : -10) +
             (c.aboveMonthAvg ? 15 : -10) +
             (c.weekChange > 0 ? c.weekChange * 2 : c.weekChange) +
             (c.rsi > 40 && c.rsi < 65 ? 15 : -5) + // Not overbought, not dead
             (c.sentiment > 0 ? c.sentiment * 20 : 0)
    })).sort((a, b) => b.score - a.score);

    if (scored.length > 0 && scored[0].score > 15 && portfolio.cash > 1) {
      const pick = scored[0];
      const shares = Math.round((portfolio.cash * 0.25) / pick.price * 10000) / 10000;
      if (shares > 0) {
        const result = await this.tradingEngine.executeBuy(agent.id, pick.symbol, shares, pick.price);
        if (result.success) {
          this.memory.addObservation(agent.id, {
            symbol: pick.symbol,
            observation: `Innovation buy @ $${pick.price.toFixed(2)} | trend:${pick.trend} week:${pick.weekChange.toFixed(1)}% RSI:${pick.rsi.toFixed(0)}`,
            confidence: 0.7
          });
          console.log(`[${agent.name}] 🔮 Growth buy: ${shares} ${pick.symbol} (trend:${pick.trend}, week:${pick.weekChange.toFixed(1)}%)`);
        }
      }
    }
  }

  // Strategy: Momentum - chase winners, dump losers fast
  async strategyMomentum(agent, portfolio, quotes, movers, analyses) {
    // Gordon chases the hottest stocks
    const allAnalyzed = Object.values(analyses).filter(a => a)
      .map(a => ({
        ...a,
        score: (a.dailyChange > 0 ? a.dailyChange * 10 : 0) + // Today's winners
               (a.weekChange > 0 ? a.weekChange * 3 : 0) + // Weekly momentum
               (a.trend === 'bullish' ? 20 : -10) +
               (a.rsi > 50 && a.rsi < 75 ? 15 : -5)
      }))
      .sort((a, b) => b.score - a.score);

    if (allAnalyzed.length > 0 && allAnalyzed[0].score > 20 && portfolio.cash > 1) {
      const pick = allAnalyzed[0];
      const shares = Math.round((portfolio.cash * 0.4) / pick.price * 10000) / 10000;
      if (shares > 0) {
        const result = await this.tradingEngine.executeBuy(agent.id, pick.symbol, shares, pick.price);
        if (result.success) {
          this.memory.addObservation(agent.id, {
            symbol: pick.symbol,
            observation: `🦈 Chasing momentum @ $${pick.price.toFixed(2)} | daily:+${pick.dailyChange.toFixed(1)}% week:+${pick.weekChange.toFixed(1)}%`,
            confidence: 0.6
          });
          console.log(`[${agent.name}] 🦈 Momentum buy: ${shares} ${pick.symbol} (daily:${pick.dailyChange.toFixed(1)}%, score:${pick.score.toFixed(0)})`);
        }
      }
    }
  }

  // Strategy: HODL - buy blue chips on dips, almost never sell
  async strategyHodl(agent, portfolio, quotes, analyses) {
    const hodlStocks = agent.preferredStocks
      .filter(s => quotes[s] && analyses[s])
      .map(s => ({ symbol: s, ...analyses[s] }));

    // Diamond buys when stocks dip - the more they drop, the more excited
    const dips = hodlStocks.filter(c => c.dailyChange < 0 || c.weekChange < 0)
      .map(c => ({
        ...c,
        score: Math.abs(c.dailyChange) * 10 + // Bigger dip = more buying
               (c.rsi < 35 ? 30 : c.rsi < 45 ? 15 : 0) + // Oversold = great
               (c.trend === 'bearish' ? 15 : 0) // Buy when others panic
      }))
      .sort((a, b) => b.score - a.score);

    if (dips.length > 0 && portfolio.cash > 1) {
      const pick = dips[0];
      const shares = Math.round((portfolio.cash * 0.4) / pick.price * 10000) / 10000;
      if (shares > 0) {
        const result = await this.tradingEngine.executeBuy(agent.id, pick.symbol, shares, pick.price);
        if (result.success) {
          console.log(`[${agent.name}] 💎🙌 Buying the dip: ${shares} ${pick.symbol} (daily:${pick.dailyChange.toFixed(1)}%, RSI:${pick.rsi.toFixed(0)})`);
        }
      }
    } else if (portfolio.cash > portfolio.startingValue * 0.5) {
      // If no dips and sitting on lots of cash, buy something blue-chip
      const safePicks = hodlStocks.filter(c => c.volatility < 2.5).sort((a, b) => a.rsi - b.rsi);
      if (safePicks.length > 0) {
        const pick = safePicks[0];
        const shares = Math.round((portfolio.cash * 0.3) / pick.price * 10000) / 10000;
        if (shares > 0) {
          await this.tradingEngine.executeBuy(agent.id, pick.symbol, shares, pick.price);
          console.log(`[${agent.name}] 💎 Steady buy: ${shares} ${pick.symbol}`);
        }
      }
    }
  }

  // Strategy: Scalping - quick in-and-out, uses analysis for timing
  async strategyScalp(agent, portfolio, quotes, analyses) {
    const winRate = this.memory.getWinRate(agent.id);
    
    // Paperhands looks for: low volatility, slight dips, quick bounce potential
    if (portfolio.cash > 1) {
      const candidates = TRADEABLE_STOCKS
        .filter(s => quotes[s] && analyses[s] && !agent.avoidStocks.includes(s))
        .map(s => ({ symbol: s, ...analyses[s], sentiment: this.memory.getStockSentiment(agent.id, s) }))
        .map(c => ({
          ...c,
          score: (c.dailyChange < 0 && c.dailyChange > -2 ? 25 : 0) +
                 (c.rsi > 35 && c.rsi < 50 ? 20 : 0) +
                 (c.trend !== 'bearish' ? 15 : -15) +
                 (c.volatility < 2 ? 15 : c.volatility > 4 ? -20 : 0) +
                 (c.sentiment > 0 ? c.sentiment * 20 : c.sentiment * 10)
        }))
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0 && candidates[0].score > 15) {
        const pick = candidates[0];
        const shares = Math.round((portfolio.cash * 0.3) / pick.price * 10000) / 10000;
        if (shares > 0) {
          const result = await this.tradingEngine.executeBuy(agent.id, pick.symbol, shares, pick.price);
          if (result.success) {
            this.memory.addObservation(agent.id, {
              symbol: pick.symbol,
              observation: `Scalp entry @ $${pick.price.toFixed(2)} | RSI:${pick.rsi.toFixed(0)} vol:${pick.volatility.toFixed(1)}% WinRate:${winRate.winRate.toFixed(0)}%`,
              confidence: 0.5
            });
            console.log(`[${agent.name}] 📄 Scalp entry: ${shares} ${pick.symbol} (RSI:${pick.rsi.toFixed(0)}, score:${pick.score.toFixed(0)})`);
          }
        }
      }
    }
  }

  // Strategy: Technical analysis - pure data, RSI + trend + support/resistance
  async strategyTechnical(agent, portfolio, quotes, analyses) {
    const allAnalyzed = TRADEABLE_STOCKS
      .filter(s => analyses[s])
      .map(s => ({ symbol: s, ...analyses[s] }));

    const buySignals = allAnalyzed
      .map(c => ({
        ...c,
        score: c.signal +
               (c.rsi < 30 ? 30 : c.rsi < 40 ? 15 : c.rsi > 70 ? -30 : 0) +
               (c.price <= c.support * 1.02 ? 25 : 0) +
               (c.price >= c.resistance * 0.98 ? -25 : 0) +
               (c.trend === 'bullish' && c.rsi < 60 ? 15 : 0) +
               (c.aboveWeekAvg && c.aboveMonthAvg ? 10 : -5)
      }))
      .sort((a, b) => b.score - a.score);

    if (buySignals.length > 0 && buySignals[0].score > 25 && portfolio.cash > 1) {
      const pick = buySignals[0];
      const shares = Math.round((portfolio.cash * 0.25) / pick.price * 10000) / 10000;
      if (shares > 0) {
        const result = await this.tradingEngine.executeBuy(agent.id, pick.symbol, shares, pick.price);
        if (result.success) {
          this.memory.addObservation(agent.id, {
            symbol: pick.symbol,
            observation: `Signal:${pick.signal.toFixed(0)} RSI:${pick.rsi.toFixed(0)} Trend:${pick.trend} Support:$${pick.support.toFixed(2)} Resistance:$${pick.resistance.toFixed(2)} SCORE:${pick.score.toFixed(0)}`,
            confidence: Math.min(0.9, pick.score / 80)
          });
          console.log(`[${agent.name}] 🤖 Technical buy: ${shares} ${pick.symbol} (signal:${pick.score.toFixed(0)}, RSI:${pick.rsi.toFixed(0)}, trend:${pick.trend})`);
        }
      }
    } else {
      console.log(`[${agent.name}] 🤖 No strong signals. Top: ${buySignals[0]?.symbol} (score:${buySignals[0]?.score.toFixed(0) || 'N/A'})`);
    }
  }

  async runElimination() {
    console.log('[Elimination] Running elimination round...');
    
    const leaderboard = await this.getLeaderboard();
    
    if (leaderboard.length < 3) {
      console.log('[Elimination] Not enough agents to eliminate');
      return { eliminated: [] };
    }

    // Get bottom 2
    const bottom2 = leaderboard.slice(-2);
    const eliminated = [];

    for (const loser of bottom2) {
      const agent = this.agents[loser.id];
      
      // Add to graveyard
      this.graveyard.push({
        ...agent,
        finalValue: loser.currentValue,
        finalReturn: loser.totalReturnPercent,
        eliminatedAt: new Date().toISOString(),
        eliminatedRound: this.competition.round,
        memorySummary: this.memory.getMemorySummary(loser.id) // Save their memories
      });

      // Clear memory for fresh start
      this.memory.clearAgentMemory(loser.id);

      // Create replacement agent with new generation
      const newGeneration = agent.generation + 1;
      this.tradingEngine.deletePortfolio(loser.id);
      delete this.agents[loser.id];
      this.createAgent(loser.id, newGeneration);

      eliminated.push({
        name: agent.name,
        generation: agent.generation,
        finalValue: loser.currentValue,
        finalReturn: loser.totalReturnPercent
      });

      console.log(`[Elimination] 💀 ${agent.name} Gen ${agent.generation} eliminated! Return: ${loser.totalReturnPercent.toFixed(2)}%`);
    }

    // Update survivors' kill counts
    for (const survivor of leaderboard.slice(0, -2)) {
      this.agents[survivor.id].kills += 2;
    }

    // Start new competition round
    this.competition.round += 1;
    this.competition.startDate = new Date().toISOString();
    this.competition.endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    this.competition.eliminated.push(...eliminated);

    this.saveAgents();
    this.saveGraveyard();
    this.saveCompetition();

    return { eliminated, newRound: this.competition.round };
  }

  getCompetitionStatus() {
    const now = new Date();
    const end = new Date(this.competition.endDate);
    const daysRemaining = Math.ceil((end - now) / (24 * 60 * 60 * 1000));

    return {
      round: this.competition.round,
      startDate: this.competition.startDate,
      endDate: this.competition.endDate,
      daysRemaining: Math.max(0, daysRemaining),
      eliminated: this.competition.eliminated
    };
  }

  getGraveyard() {
    return this.graveyard.sort((a, b) => 
      new Date(b.eliminatedAt) - new Date(a.eliminatedAt)
    );
  }

  async generateDailySummary() {
    const leaderboard = await this.getLeaderboard();
    const trades = this.tradingEngine.getAllTrades(50);
    const todayTrades = trades.filter(t => {
      const tradeDate = new Date(t.timestamp).toDateString();
      return tradeDate === new Date().toDateString();
    });

    const summary = {
      date: new Date().toISOString(),
      leaderboard: leaderboard.map(a => ({
        rank: a.rank,
        name: a.name,
        value: a.currentValue.toFixed(2),
        return: a.totalReturnPercent.toFixed(2) + '%'
      })),
      topPerformer: leaderboard[0],
      worstPerformer: leaderboard[leaderboard.length - 1],
      totalTradesToday: todayTrades.length,
      competition: this.getCompetitionStatus()
    };

    // Save daily summary
    const summariesFile = path.join(DATA_DIR, 'daily-summaries.json');
    let summaries = [];
    try {
      summaries = JSON.parse(fs.readFileSync(summariesFile, 'utf8'));
    } catch {}
    summaries.push(summary);
    fs.writeFileSync(summariesFile, JSON.stringify(summaries.slice(-30), null, 2));

    // Each agent records their daily reflection
    for (const agent of leaderboard) {
      const mood = agent.totalReturnPercent > 5 ? 'euphoric' : 
                   agent.totalReturnPercent > 0 ? 'optimistic' :
                   agent.totalReturnPercent > -5 ? 'cautious' : 'desperate';
      
      this.memory.addDailyReflection(agent.id, {
        portfolioValue: agent.currentValue,
        tradesMade: todayTrades.filter(t => t.agentId === agent.id).length,
        reflection: `Day ended at $${agent.currentValue.toFixed(2)} (${agent.totalReturnPercent.toFixed(1)}%). Rank #${agent.rank}.`,
        mood,
        strategyAdjustment: agent.isElimination ? 'Need to be more aggressive - in danger zone!' : null
      });
    }

    console.log('[Summary] Daily summary generated');
    console.log(`  Leader: ${summary.topPerformer.name} ($${summary.topPerformer.currentValue.toFixed(2)})`);
    console.log(`  Laggard: ${summary.worstPerformer.name} ($${summary.worstPerformer.currentValue.toFixed(2)})`);

    return summary;
  }
}
