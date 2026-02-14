// Direct Yahoo Finance API without the library (avoids crumb/rate limit issues)

// Tradeable stocks for agents
export const TRADEABLE_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'META', 'AMZN',
  'JPM', 'V', 'BAC', 'GS',
  'WMT', 'KO', 'JNJ',
  'SPY', 'QQQ',
  'GME', 'AMC', 'PLTR',
  'CRM', 'SHOP', 'NET',
  'XOM', 'CVX'
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchYahooQuote(symbol) {
  // Use query2 v8 API - more reliable, no crumb needed
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    }
  });
  
  if (!res.ok) {
    throw new Error(`Yahoo API error: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('No data returned');
  
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
    name: meta.shortName || meta.longName || symbol,
    marketCap: null,
    peRatio: null,
    avgVolume: null
  };
}

export class MarketData {
  constructor() {
    this.quoteCache = new Map();
    this.cacheTTL = 300000; // 5 minute cache
    this.lastRequestTime = 0;
    this.minRequestInterval = 500;
  }

  async throttle() {
    const now = Date.now();
    const timeSince = now - this.lastRequestTime;
    if (timeSince < this.minRequestInterval) {
      await delay(this.minRequestInterval - timeSince);
    }
    this.lastRequestTime = Date.now();
  }

  async getQuote(symbol, retries = 3) {
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
        console.error(`[MarketData] Error fetching ${symbol} (attempt ${i + 1}):`, error.message);
        if (error.message.includes('429')) {
          await delay(Math.pow(2, i + 1) * 2000);
        } else if (i === retries - 1) {
          throw error;
        } else {
          await delay(1000);
        }
      }
    }
    throw new Error(`Failed to fetch ${symbol} after ${retries} retries`);
  }

  async getMultipleQuotes(symbols) {
    const quotes = {};
    for (const symbol of symbols) {
      try {
        quotes[symbol] = await this.getQuote(symbol);
      } catch (error) {
        console.error(`[MarketData] Failed to fetch ${symbol}`);
      }
    }
    return quotes;
  }

  async getTopMovers() {
    const quotes = await this.getMultipleQuotes(TRADEABLE_STOCKS);
    const sorted = Object.values(quotes)
      .filter(q => q && q.changePercent !== undefined)
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    
    return {
      gainers: sorted.filter(q => q.changePercent > 0).slice(0, 3),
      losers: sorted.filter(q => q.changePercent < 0).slice(0, 3)
    };
  }

  isMarketOpen() {
    const now = new Date();
    const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = nyTime.getDay();
    const hours = nyTime.getHours();
    const minutes = nyTime.getMinutes();
    const time = hours * 60 + minutes;
    
    if (day === 0 || day === 6) return false;
    if (time < 570 || time >= 960) return false; // 9:30 AM - 4:00 PM
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

  // Analyze a stock's trend from its chart data
  async analyzeStock(symbol) {
    try {
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

      // Calculate indicators
      const weekAvg = week.reduce((a, b) => a + b, 0) / week.length;
      const twoWeekAvg = twoWeek.reduce((a, b) => a + b, 0) / twoWeek.length;
      const monthAvg = month.reduce((a, b) => a + b, 0) / month.length;

      // Daily change
      const dailyChange = prev ? ((current - prev) / prev) * 100 : 0;
      
      // Week change
      const weekChange = ((current - week[0]) / week[0]) * 100;
      
      // Month change  
      const monthChange = ((current - month[0]) / month[0]) * 100;

      // Volatility (std dev of daily returns)
      const returns = [];
      for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i-1]) / closes[i-1]);
      }
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const volatility = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) * 100;

      // Trend direction
      const aboveWeekAvg = current > weekAvg;
      const aboveMonthAvg = current > monthAvg;
      const trend = aboveWeekAvg && aboveMonthAvg ? 'bullish' : 
                    !aboveWeekAvg && !aboveMonthAvg ? 'bearish' : 'neutral';

      // RSI (simplified 14-day)
      const gains = returns.slice(-14).filter(r => r > 0);
      const losses = returns.slice(-14).filter(r => r < 0).map(r => Math.abs(r));
      const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / 14 : 0;
      const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / 14 : 0;
      const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
      const rsi = 100 - (100 / (1 + rs));

      // Support/resistance (recent highs and lows)
      const recentHighs = result.indicators?.quote?.[0]?.high?.filter(h => h != null).slice(-10) || [];
      const recentLows = result.indicators?.quote?.[0]?.low?.filter(l => l != null).slice(-10) || [];
      const resistance = recentHighs.length ? Math.max(...recentHighs) : current * 1.05;
      const support = recentLows.length ? Math.min(...recentLows) : current * 0.95;

      // Signal score: -100 (strong sell) to +100 (strong buy)
      let signal = 0;
      if (trend === 'bullish') signal += 20;
      if (trend === 'bearish') signal -= 20;
      if (rsi < 30) signal += 30; // Oversold = buy
      if (rsi > 70) signal -= 30; // Overbought = sell
      if (dailyChange < -2) signal += 15; // Big dip = potential buy
      if (dailyChange > 3) signal -= 10; // Big spike = maybe take profit
      if (weekChange > 5) signal -= 10; // Overextended
      if (weekChange < -5) signal += 15; // Beaten down

      return {
        symbol,
        price: current,
        dailyChange,
        weekChange,
        monthChange,
        volatility,
        trend,
        rsi,
        signal,
        support,
        resistance,
        aboveWeekAvg,
        aboveMonthAvg,
        weekAvg,
        monthAvg
      };
    } catch (error) {
      console.error(`[MarketData] Analysis error for ${symbol}:`, error.message);
      return null;
    }
  }

  // Analyze multiple stocks (with caching)
  async analyzeMultiple(symbols) {
    const analyses = {};
    for (const symbol of symbols) {
      // Use cache key with 'analysis_' prefix
      const cacheKey = 'analysis_' + symbol;
      const cached = this.quoteCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 600000) { // 10 min cache for analysis
        analyses[symbol] = cached.data;
        continue;
      }
      
      await this.throttle();
      const analysis = await this.analyzeStock(symbol);
      if (analysis) {
        analyses[symbol] = analysis;
        this.quoteCache.set(cacheKey, { data: analysis, timestamp: Date.now() });
      }
    }
    return analyses;
  }

  getTradeableStocks() {
    return TRADEABLE_STOCKS;
  }
}
