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
    
    // Get market data for all tradeable stocks
    const quotes = await this.marketData.getMultipleQuotes(TRADEABLE_STOCKS);
    const movers = await this.marketData.getTopMovers();

    for (const agentId of Object.keys(this.agents)) {
      const agent = this.agents[agentId];
      if (agent.status !== 'active') continue;

      try {
        await this.executeAgentStrategy(agent, quotes, movers);
        
        // Record portfolio snapshot
        const value = await this.tradingEngine.calculatePortfolioValue(agentId, this.marketData);
        this.tradingEngine.recordPortfolioSnapshot(agentId, value);
      } catch (error) {
        console.error(`[Trading] Error for ${agent.name}:`, error.message);
      }
    }

    console.log('[Trading] Trading round complete');
  }

  async executeAgentStrategy(agent, quotes, movers) {
    const portfolio = this.tradingEngine.getPortfolio(agent.id);
    if (!portfolio) return;

    // Decide if agent will trade this round
    if (Math.random() > agent.tradeFrequency) {
      return; // Skip this round
    }

    switch (agent.strategy) {
      case 'value':
        await this.strategyValue(agent, portfolio, quotes);
        break;
      case 'meme':
        await this.strategyMeme(agent, portfolio, quotes);
        break;
      case 'growth':
        await this.strategyGrowth(agent, portfolio, quotes);
        break;
      case 'momentum':
        await this.strategyMomentum(agent, portfolio, quotes, movers);
        break;
      case 'hodl':
        await this.strategyHodl(agent, portfolio, quotes);
        break;
      case 'scalp':
        await this.strategyScalp(agent, portfolio, quotes);
        break;
      case 'technical':
        await this.strategyTechnical(agent, portfolio, quotes);
        break;
    }
  }

  // Strategy: Value investing (buy undervalued stocks)
  async strategyValue(agent, portfolio, quotes) {
    // Use memory to avoid stocks that burned us
    const worstStocks = this.memory.getWorstStocks(agent.id, 5).map(s => s.symbol);
    
    const candidates = agent.preferredStocks
      .filter(s => quotes[s] && quotes[s].price) // Just need a valid quote
      .filter(s => !agent.avoidStocks.includes(s))
      .filter(s => !worstStocks.includes(s)) // Memory: avoid past losers
      .filter(s => !quotes[s].changePercent || quotes[s].changePercent < 2); // Value: don't buy overheated

    // Sort by memory sentiment (prefer stocks we've done well with)
    candidates.sort((a, b) => {
      const sentA = this.memory.getStockSentiment(agent.id, a);
      const sentB = this.memory.getStockSentiment(agent.id, b);
      return sentB - sentA;
    });

    if (candidates.length > 0 && portfolio.cash > 1) {
      const symbol = candidates[0] || candidates[Math.floor(Math.random() * candidates.length)];
      const price = quotes[symbol].price;
      const shares = Math.round((portfolio.cash * 0.3) / price * 10000) / 10000;
      
      if (shares > 0) {
        const result = await this.tradingEngine.executeBuy(agent.id, symbol, shares, price);
        if (result.success) {
          this.memory.addObservation(agent.id, {
            symbol, observation: `Bought ${symbol} at $${price.toFixed(2)} - low P/E value play`, confidence: 0.6
          });
          console.log(`[${agent.name}] Bought ${shares} ${symbol} @ $${price.toFixed(2)}`);
        }
      }
    }
  }

  // Strategy: Meme stocks (YOLO)
  async strategyMeme(agent, portfolio, quotes) {
    const memeStocks = agent.preferredStocks.filter(s => quotes[s]);
    
    if (memeStocks.length > 0 && portfolio.cash > 1) {
      // Random YOLO buy
      if (Math.random() > 0.4) {
        const symbol = memeStocks[Math.floor(Math.random() * memeStocks.length)];
        const price = quotes[symbol].price;
        const shares = Math.round((portfolio.cash * (0.3 + Math.random() * 0.5)) / price * 10000) / 10000;
        
        if (shares > 0) {
          await this.tradingEngine.executeBuy(agent.id, symbol, shares, price);
          console.log(`[${agent.name}] 🚀 YOLO'd ${shares} ${symbol} @ $${price.toFixed(2)}`);
        }
      }
    }

    // Sometimes panic sell (Elon is chaotic)
    const positions = Object.entries(portfolio.positions);
    if (positions.length > 0 && Math.random() > 0.7) {
      const [symbol, position] = positions[Math.floor(Math.random() * positions.length)];
      if (quotes[symbol]) {
        const sellShares = Math.round(position.shares * Math.random() * 10000) / 10000 || position.shares;
        await this.tradingEngine.executeSell(agent.id, symbol, sellShares, quotes[symbol].price);
        console.log(`[${agent.name}] Panic sold ${sellShares} ${symbol}`);
      }
    }
  }

  // Strategy: Growth stocks
  async strategyGrowth(agent, portfolio, quotes) {
    const growthStocks = agent.preferredStocks.filter(s => 
      quotes[s] && !agent.avoidStocks.includes(s)
    );

    if (growthStocks.length > 0 && portfolio.cash > 1) {
      const symbol = growthStocks[Math.floor(Math.random() * growthStocks.length)];
      const price = quotes[symbol].price;
      const shares = Math.round((portfolio.cash * 0.25) / price * 10000) / 10000;
      
      if (shares > 0) {
        await this.tradingEngine.executeBuy(agent.id, symbol, shares, price);
        console.log(`[${agent.name}] Innovation buy: ${shares} ${symbol}`);
      }
    }
  }

  // Strategy: Momentum (chase winners)
  async strategyMomentum(agent, portfolio, quotes, movers) {
    // Buy top gainers
    if (movers.gainers.length > 0 && portfolio.cash > 1) {
      const winner = movers.gainers[Math.floor(Math.random() * Math.min(3, movers.gainers.length))];
      const price = winner.price;
      const shares = Math.round((portfolio.cash * 0.4) / price * 10000) / 10000;
      
      if (shares > 0) {
        await this.tradingEngine.executeBuy(agent.id, winner.symbol, shares, price);
        console.log(`[${agent.name}] 🦈 Chasing winner: ${shares} ${winner.symbol} (+${winner.changePercent.toFixed(1)}%)`);
      }
    }

    // Sell losers quickly
    for (const [symbol, position] of Object.entries(portfolio.positions)) {
      if (quotes[symbol]) {
        const currentPrice = quotes[symbol].price;
        const pnlPercent = ((currentPrice - position.avgCost) / position.avgCost) * 100;
        
        if (pnlPercent < -5) { // Cut losses at -5%
          await this.tradingEngine.executeSell(agent.id, symbol, position.shares, currentPrice);
          console.log(`[${agent.name}] Cut losses: ${symbol} @ ${pnlPercent.toFixed(1)}%`);
        }
      }
    }
  }

  // Strategy: HODL (buy and hold)
  async strategyHodl(agent, portfolio, quotes) {
    // Only buy, never sell (unless forced)
    const hodlStocks = agent.preferredStocks.filter(s => quotes[s]);
    
    if (hodlStocks.length > 0 && portfolio.cash > 1) {
      const symbol = hodlStocks[Math.floor(Math.random() * hodlStocks.length)];
      const price = quotes[symbol].price;
      
      // Buy on red days (buy the dip!) or just buy if no change data
      if (!quotes[symbol].changePercent || quotes[symbol].changePercent < 0 || Math.random() > 0.5) {
        const shares = Math.round((portfolio.cash * 0.5) / price * 10000) / 10000;
        if (shares > 0) {
          await this.tradingEngine.executeBuy(agent.id, symbol, shares, price);
          console.log(`[${agent.name}] 💎🙌 Buying the dip: ${shares} ${symbol}`);
        }
      }
    }
  }

  // Strategy: Scalping (quick trades)
  async strategyScalp(agent, portfolio, quotes) {
    // Use memory to adjust thresholds
    const winRate = this.memory.getWinRate(agent.id);
    const profitThreshold = winRate.winRate > 60 ? 1.5 : 2.5; // More aggressive if winning
    const lossThreshold = winRate.winRate < 40 ? -1.5 : -2; // Tighter stops if losing

    // Quick profit taking
    for (const [symbol, position] of Object.entries(portfolio.positions)) {
      if (quotes[symbol]) {
        const currentPrice = quotes[symbol].price;
        const pnlPercent = ((currentPrice - position.avgCost) / position.avgCost) * 100;
        
        if (pnlPercent > profitThreshold || pnlPercent < lossThreshold) {
          const result = await this.tradingEngine.executeSell(agent.id, symbol, position.shares, currentPrice);
          if (result.success) {
            // Record in memory
            this.memory.recordTradeOutcome(agent.id, {
              symbol, action: 'SELL', entryPrice: position.avgCost, exitPrice: currentPrice,
              pnl: result.pnl, pnlPercent, reason: pnlPercent > 0 ? 'Take profit' : 'Stop loss',
              lesson: pnlPercent > 0 ? `${symbol} hit profit target` : `${symbol} hit stop - cut losses quick`
            });
            // Update sentiment
            this.memory.updateBelief(agent.id, {
              beliefType: 'stock_sentiment', symbol,
              value: Math.max(-1, Math.min(1, (this.memory.getStockSentiment(agent.id, symbol) + (pnlPercent > 0 ? 0.2 : -0.3)))),
              note: `Last trade: ${pnlPercent.toFixed(1)}%`
            });
            console.log(`[${agent.name}] 📄 Quick exit: ${symbol} @ ${pnlPercent.toFixed(1)}%`);
          }
        }
      }
    }

    // Quick buy - prefer stocks with good past performance
    if (portfolio.cash > 1) {
      const allStocks = TRADEABLE_STOCKS.filter(s => quotes[s] && !agent.avoidStocks.includes(s));
      // Sort by sentiment from memory
      allStocks.sort((a, b) => this.memory.getStockSentiment(agent.id, b) - this.memory.getStockSentiment(agent.id, a));
      
      const symbol = allStocks[0] || allStocks[Math.floor(Math.random() * allStocks.length)];
      if (symbol && quotes[symbol]) {
        const price = quotes[symbol].price;
        const shares = Math.round((portfolio.cash * 0.3) / price * 10000) / 10000;
        
        if (shares > 0) {
          await this.tradingEngine.executeBuy(agent.id, symbol, shares, price);
          console.log(`[${agent.name}] Quick entry: ${shares} ${symbol}`);
        }
      }
    }
  }

  // Strategy: Technical analysis
  async strategyTechnical(agent, portfolio, quotes) {
    // Simple technical: buy oversold, sell overbought
    for (const symbol of TRADEABLE_STOCKS) {
      if (!quotes[symbol]) continue;
      
      const quote = quotes[symbol];
      const distanceFromHigh = ((quote.fiftyTwoWeekHigh - quote.price) / quote.fiftyTwoWeekHigh) * 100;
      const distanceFromLow = ((quote.price - quote.fiftyTwoWeekLow) / quote.fiftyTwoWeekLow) * 100;
      
      // Buy if near 52-week low (oversold)
      if (distanceFromHigh > 30 && portfolio.cash > 1) {
        const shares = Math.round((portfolio.cash * 0.2) / quote.price * 10000) / 10000;
        if (shares > 0) {
          await this.tradingEngine.executeBuy(agent.id, symbol, shares, quote.price);
          console.log(`[${agent.name}] 🤖 Technical buy: ${symbol} (${distanceFromHigh.toFixed(0)}% from high)`);
          break;
        }
      }
      
      // Sell if near 52-week high (overbought)
      if (portfolio.positions[symbol] && distanceFromLow > 50) {
        const position = portfolio.positions[symbol];
        await this.tradingEngine.executeSell(agent.id, symbol, position.shares, quote.price);
        console.log(`[${agent.name}] 🤖 Technical sell: ${symbol} (${distanceFromLow.toFixed(0)}% from low)`);
      }
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
