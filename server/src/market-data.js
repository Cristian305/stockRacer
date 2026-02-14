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

  getTradeableStocks() {
    return TRADEABLE_STOCKS;
  }
}
