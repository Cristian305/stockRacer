// StockRacer Market Data - Fortune 500+ universe with live scanning

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Full stock universe - 219 stocks across all sectors
export const TRADEABLE_STOCKS = [
  // Tech (30)
  'AAPL','MSFT','GOOGL','AMZN','META','NVDA','TSLA','AVGO','ORCL','CRM','AMD','INTC','CSCO','ADBE','NOW','INTU','IBM','QCOM','TXN','AMAT','MU','LRCX','ADI','KLAC','SNPS','CDNS','MRVL','FTNT','PANW','CRWD',
  // Finance (20)
  'JPM','V','MA','BAC','WFC','GS','MS','BLK','SCHW','AXP','C','USB','PNC','TFC','COF','BK','STT','FITB','RF','CFG',
  // Healthcare (20)
  'UNH','JNJ','LLY','PFE','ABBV','MRK','TMO','ABT','DHR','BMY','AMGN','MDT','ISRG','GILD','VRTX','REGN','BSX','ZTS','SYK','BDX',
  // Consumer (20)
  'WMT','PG','KO','PEP','COST','MCD','NKE','SBUX','TGT','LOW','HD','TJX','ROST','DG','DLTR','YUM','DPZ','CMG','ORLY','AZO',
  // Industrial (20)
  'CAT','BA','GE','HON','UNP','UPS','RTX','LMT','NOC','GD','DE','MMM','EMR','ITW','PH','ROK','ETN','CMI','PCAR','WM',
  // Energy (20)
  'XOM','CVX','COP','SLB','EOG','PXD','MPC','VLO','PSX','OXY','DVN','HAL','FANG','HES','BKR','CTRA','OVV','APA','MRO','AR',
  // Communication (16)
  'DIS','CMCSA','NFLX','T','VZ','TMUS','CHTR','EA','TTWO','WBD','PARA','LYV','MTCH','RBLX','SNAP','PINS',
  // Real Estate (10)
  'AMT','PLD','CCI','EQIX','PSA','O','WELL','DLR','SPG','VICI',
  // Utilities (10)
  'NEE','DUK','SO','D','AEP','SRE','EXC','XEL','ED','WEC',
  // Materials (10)
  'LIN','APD','SHW','ECL','NEM','FCX','CTVA','DD','DOW','PPG',
  // ETFs (13)
  'SPY','QQQ','IWM','DIA','VTI','VOO','ARKK','XLK','XLF','XLE','XLV','XLI','SOXX',
  // Meme/Popular (10)
  'GME','AMC','PLTR','RIVN','LCID','SOFI','HOOD','COIN','MSTR','AFRM',
  // Growth (10)
  'SHOP','NET','DDOG','SNOW','ZS','MDB','OKTA','BILL','HUBS','VEEV',
  // International ADRs (10)
  'TSM','BABA','NVO','ASML','SAP','TM','SNY','AZN','SHEL','BP'
];

// Stock sectors for agent preferences
export const SECTORS = {
  tech: TRADEABLE_STOCKS.slice(0, 30),
  finance: TRADEABLE_STOCKS.slice(30, 50),
  healthcare: TRADEABLE_STOCKS.slice(50, 70),
  consumer: TRADEABLE_STOCKS.slice(70, 90),
  industrial: TRADEABLE_STOCKS.slice(90, 110),
  energy: TRADEABLE_STOCKS.slice(110, 130),
  communication: TRADEABLE_STOCKS.slice(130, 146),
  realestate: TRADEABLE_STOCKS.slice(146, 156),
  utilities: TRADEABLE_STOCKS.slice(156, 166),
  materials: TRADEABLE_STOCKS.slice(166, 176),
  etfs: TRADEABLE_STOCKS.slice(176, 189),
  meme: TRADEABLE_STOCKS.slice(189, 199),
  growth: TRADEABLE_STOCKS.slice(199, 209),
  international: TRADEABLE_STOCKS.slice(209, 219),
};

async function fetchYahooQuote(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    }
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No data');
  const meta = result.meta;
  const indicators = result.indicators?.quote?.[0];
  
  return {
    symbol: meta.symbol,
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose || meta.chartPreviousClose,
    change: meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose),
    changePercent: ((meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose)) / (meta.previousClose || meta.chartPreviousClose)) * 100,
    volume: indicators?.volume?.[indicators.volume.length - 1] || 0,
    high: indicators?.high?.[indicators.high.length - 1] || meta.regularMarketPrice,
    low: indicators?.low?.[indicators.low.length - 1] || meta.regularMarketPrice,
    open: indicators?.open?.[indicators.open.length - 1] || meta.regularMarketPrice,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    name: meta.shortName || meta.longName || symbol
  };
}

async function fetchYahooAnalysis(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    }
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No data');

  const closes = result.indicators?.quote?.[0]?.close?.filter(c => c != null) || [];
  if (closes.length < 5) return null;

  const current = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const week = closes.slice(-5);
  const twoWeek = closes.slice(-10);
  const month = closes;

  const weekAvg = week.reduce((a, b) => a + b, 0) / week.length;
  const monthAvg = month.reduce((a, b) => a + b, 0) / month.length;
  const dailyChange = prev ? ((current - prev) / prev) * 100 : 0;
  const weekChange = ((current - week[0]) / week[0]) * 100;
  const monthChange = ((current - month[0]) / month[0]) * 100;

  const returns = [];
  for (let i = 1; i < closes.length; i++) returns.push((closes[i] - closes[i-1]) / closes[i-1]);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) * 100;

  const aboveWeekAvg = current > weekAvg;
  const aboveMonthAvg = current > monthAvg;
  const trend = aboveWeekAvg && aboveMonthAvg ? 'bullish' : !aboveWeekAvg && !aboveMonthAvg ? 'bearish' : 'neutral';

  const gains = returns.slice(-14).filter(r => r > 0);
  const losses = returns.slice(-14).filter(r => r < 0).map(r => Math.abs(r));
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / 14 : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / 14 : 0;
  const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
  const rsi = 100 - (100 / (1 + rs));

  const recentHighs = result.indicators?.quote?.[0]?.high?.filter(h => h != null).slice(-10) || [];
  const recentLows = result.indicators?.quote?.[0]?.low?.filter(l => l != null).slice(-10) || [];
  const resistance = recentHighs.length ? Math.max(...recentHighs) : current * 1.05;
  const support = recentLows.length ? Math.min(...recentLows) : current * 0.95;

  let signal = 0;
  if (trend === 'bullish') signal += 20;
  if (trend === 'bearish') signal -= 20;
  if (rsi < 30) signal += 30;
  if (rsi > 70) signal -= 30;
  if (dailyChange < -2) signal += 15;
  if (dailyChange > 3) signal -= 10;
  if (weekChange > 5) signal -= 10;
  if (weekChange < -5) signal += 15;

  return {
    symbol, price: current, dailyChange, weekChange, monthChange, volatility,
    trend, rsi, signal, support, resistance, aboveWeekAvg, aboveMonthAvg, weekAvg, monthAvg
  };
}

export class MarketData {
  constructor() {
    this.quoteCache = new Map();
    this.cacheTTL = 15000; // 15 second quote cache for near-live data
    this.lastRequestTime = 0;
    this.minRequestInterval = 200; // 200ms between requests
    
    // Rotating fetch system - fetch batches of stocks continuously
    this.fetchIndex = 0;
    this.batchSize = 10; // Fetch 10 stocks per batch
    this.isRotating = false;
  }

  async throttle() {
    const now = Date.now();
    const timeSince = now - this.lastRequestTime;
    if (timeSince < this.minRequestInterval) {
      await delay(this.minRequestInterval - timeSince);
    }
    this.lastRequestTime = Date.now();
  }

  async getQuote(symbol, retries = 2) {
    const cached = this.quoteCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    for (let i = 0; i < retries; i++) {
      try {
        await this.throttle();
        const data = await fetchYahooQuote(symbol);
        this.quoteCache.set(symbol, { data, timestamp: Date.now() });
        return data;
      } catch (error) {
        if (error.message.includes('429')) {
          await delay(Math.pow(2, i + 1) * 1000);
        } else if (i === retries - 1) {
          throw error;
        } else {
          await delay(500);
        }
      }
    }
    throw new Error(`Failed to fetch ${symbol}`);
  }

  async getMultipleQuotes(symbols) {
    const quotes = {};
    for (const symbol of symbols) {
      try {
        quotes[symbol] = await this.getQuote(symbol);
      } catch (error) {
        // Use cached even if expired
        const cached = this.quoteCache.get(symbol);
        if (cached) quotes[symbol] = cached.data;
      }
    }
    return quotes;
  }

  // Start continuous rotating fetch - keeps all stock data fresh
  startLiveScanning() {
    if (this.isRotating) return;
    this.isRotating = true;
    console.log(`[MarketData] 🔴 LIVE scanning started for ${TRADEABLE_STOCKS.length} stocks`);
    
    this.rotationInterval = setInterval(async () => {
      if (!this.isMarketOpen()) return;
      
      const batch = TRADEABLE_STOCKS.slice(this.fetchIndex, this.fetchIndex + this.batchSize);
      if (batch.length === 0) {
        this.fetchIndex = 0;
        return;
      }

      for (const symbol of batch) {
        try {
          await this.throttle();
          const data = await fetchYahooQuote(symbol);
          this.quoteCache.set(symbol, { data, timestamp: Date.now() });
        } catch (e) {
          // Skip failures silently
        }
      }

      this.fetchIndex += this.batchSize;
      if (this.fetchIndex >= TRADEABLE_STOCKS.length) this.fetchIndex = 0;
    }, 3000); // Fetch a batch every 3 seconds = full rotation in ~66 seconds for 219 stocks
  }

  stopLiveScanning() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.isRotating = false;
      console.log('[MarketData] Live scanning stopped');
    }
  }

  async getTopMovers() {
    const allQuotes = [];
    for (const symbol of TRADEABLE_STOCKS) {
      const cached = this.quoteCache.get(symbol);
      if (cached) allQuotes.push(cached.data);
    }
    const sorted = allQuotes
      .filter(q => q && q.changePercent !== undefined)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    
    return {
      gainers: sorted.filter(q => q.changePercent > 0).slice(0, 10),
      losers: sorted.filter(q => q.changePercent < 0).slice(0, 10)
    };
  }

  async analyzeStock(symbol) {
    try {
      await this.throttle();
      return await fetchYahooAnalysis(symbol);
    } catch (error) {
      return null;
    }
  }

  async analyzeMultiple(symbols) {
    const analyses = {};
    for (const symbol of symbols) {
      const cacheKey = 'analysis_' + symbol;
      const cached = this.quoteCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 120000) { // 2 min cache
        analyses[symbol] = cached.data;
        continue;
      }
      const analysis = await this.analyzeStock(symbol);
      if (analysis) {
        analyses[symbol] = analysis;
        this.quoteCache.set(cacheKey, { data: analysis, timestamp: Date.now() });
      }
    }
    return analyses;
  }

  // Rotating deep analysis - analyzes a batch of stocks each cycle
  async analyzeNextBatch(batchSize = 15) {
    if (!this._analysisBatchIndex) this._analysisBatchIndex = 0;
    
    const batch = TRADEABLE_STOCKS.slice(this._analysisBatchIndex, this._analysisBatchIndex + batchSize);
    if (batch.length === 0) {
      this._analysisBatchIndex = 0;
      return;
    }
    
    for (const symbol of batch) {
      const cacheKey = 'analysis_' + symbol;
      try {
        await this.throttle();
        const analysis = await fetchYahooAnalysis(symbol);
        if (analysis) {
          this.quoteCache.set(cacheKey, { data: analysis, timestamp: Date.now() });
        }
      } catch (e) { /* skip */ }
    }
    
    this._analysisBatchIndex += batchSize;
    if (this._analysisBatchIndex >= TRADEABLE_STOCKS.length) this._analysisBatchIndex = 0;
    
    console.log(`[Analysis] Batch ${Math.ceil(this._analysisBatchIndex / batchSize)}/${Math.ceil(TRADEABLE_STOCKS.length / batchSize)} complete`);
  }

  // Get cached analysis for all stocks (for fast agent decisions)
  getCachedAnalyses() {
    const analyses = {};
    for (const symbol of TRADEABLE_STOCKS) {
      const cached = this.quoteCache.get('analysis_' + symbol);
      if (cached) analyses[symbol] = cached.data;
    }
    return analyses;
  }

  // Get all cached quotes
  getCachedQuotes() {
    const quotes = {};
    for (const symbol of TRADEABLE_STOCKS) {
      const cached = this.quoteCache.get(symbol);
      if (cached) quotes[symbol] = cached.data;
    }
    return quotes;
  }

  isMarketOpen() {
    const now = new Date();
    const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = nyTime.getDay();
    const time = nyTime.getHours() * 60 + nyTime.getMinutes();
    if (day === 0 || day === 6) return false;
    if (time < 570 || time >= 960) return false;
    return true;
  }

  getNextMarketOpen() {
    const now = new Date();
    const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    let nextOpen = new Date(nyTime);
    nextOpen.setHours(9, 30, 0, 0);
    if (nyTime >= nextOpen) nextOpen.setDate(nextOpen.getDate() + 1);
    while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6) nextOpen.setDate(nextOpen.getDate() + 1);
    return nextOpen.toISOString();
  }

  getNextMarketClose() {
    const now = new Date();
    const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    let nextClose = new Date(nyTime);
    nextClose.setHours(16, 0, 0, 0);
    if (nyTime >= nextClose) nextClose.setDate(nextClose.getDate() + 1);
    while (nextClose.getDay() === 0 || nextClose.getDay() === 6) nextClose.setDate(nextClose.getDate() + 1);
    return nextClose.toISOString();
  }

  getTradeableStocks() {
    return TRADEABLE_STOCKS;
  }

  getStockCount() {
    return TRADEABLE_STOCKS.length;
  }

  getCachedCount() {
    let count = 0;
    for (const symbol of TRADEABLE_STOCKS) {
      if (this.quoteCache.has(symbol)) count++;
    }
    return count;
  }
}
