import { useState, useEffect } from 'react';
import { Trophy, Skull, TrendingUp, TrendingDown, Clock, Activity, DollarSign, Target, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  color: string;
  personality: string;
  generation: number;
  rank?: number;
  currentValue?: number;
  totalReturn?: number;
  totalReturnPercent?: number;
  tradesCount?: number;
  isElimination?: boolean;
  portfolio?: {
    cash: number;
    positions: Record<string, { shares: number; avgCost: number }>;
    history: { timestamp: string; value: number }[];
  };
}

interface Trade {
  id: string;
  agentId: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  shares: number;
  price: number;
  total: number;
  pnl?: number;
  timestamp: string;
}

interface Competition {
  round: number;
  startDate: string;
  endDate: string;
  daysRemaining: number;
}

interface MarketStatus {
  isOpen: boolean;
  nextOpen: string;
  nextClose: string;
}

export default function App() {
  const [leaderboard, setLeaderboard] = useState<Agent[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [graveyard, setGraveyard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const [lb, tr, comp, market, grave] = await Promise.all([
        fetch('/api/leaderboard').then(r => r.json()),
        fetch('/api/trades?limit=20').then(r => r.json()),
        fetch('/api/competition').then(r => r.json()),
        fetch('/api/market/status').then(r => r.json()),
        fetch('/api/graveyard').then(r => r.json())
      ]);
      setLeaderboard(lb);
      setTrades(tr);
      setCompetition(comp);
      setMarketStatus(market);
      setGraveyard(grave);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }

  async function selectAgent(id: string) {
    const agent = await fetch(`/api/agents/${id}`).then(r => r.json());
    setSelectedAgent(agent);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">🏎️ Loading StockRacer...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              🏎️ StockRacer
              <span className="text-lg font-normal text-slate-400">AI Trading Arena</span>
            </h1>
            <p className="text-slate-500 mt-1">7 AI agents battle for trading supremacy. Bottom 2 get eliminated.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${marketStatus?.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <Activity className="w-4 h-4" />
              {marketStatus?.isOpen ? 'Market Open' : 'Market Closed'}
            </div>
            {competition && (
              <div className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {competition.daysRemaining}d until elimination
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Leaderboard */}
        <div className="col-span-8">
          <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Leaderboard
              <span className="text-sm text-slate-500 ml-2">Round {competition?.round || 1}</span>
            </h2>
            
            <div className="space-y-3">
              {leaderboard.map((agent, idx) => (
                <div 
                  key={agent.id}
                  onClick={() => selectAgent(agent.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${
                    agent.isElimination ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-800/50 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 
                        agent.isElimination ? 'rank-danger text-white' : 'bg-slate-700'
                      }`}>
                        {agent.rank}
                      </div>
                      
                      {/* Avatar & Name */}
                      <div className="text-3xl">{agent.avatar}</div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {agent.name}
                          <span className="text-xs text-slate-500">Gen {agent.generation}</span>
                          {agent.isElimination && (
                            <span className="text-xs bg-red-500/30 text-red-400 px-2 py-0.5 rounded">⚠️ DANGER</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400">{agent.personality}</div>
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Portfolio Value</div>
                        <div className="text-xl font-mono font-semibold">
                          ${agent.currentValue?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Return</div>
                        <div className={`text-xl font-mono font-semibold ${
                          (agent.totalReturnPercent || 0) >= 0 ? 'pos-gain' : 'pos-loss'
                        }`}>
                          {(agent.totalReturnPercent || 0) >= 0 ? '+' : ''}
                          {agent.totalReturnPercent?.toFixed(2) || '0.00'}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-400">Trades</div>
                        <div className="text-lg font-mono">{agent.tradesCount || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Trades */}
          <div className="glass rounded-2xl p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              Recent Trades
            </h2>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {trades.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No trades yet. Wait for market to open!</div>
              ) : (
                trades.map((trade) => {
                  const agent = leaderboard.find(a => a.id === trade.agentId);
                  return (
                    <div key={trade.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{agent?.avatar || '🤖'}</span>
                        <span className="font-medium">{agent?.name || trade.agentId}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          trade.type === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {trade.type}
                        </span>
                        <span className="font-mono font-medium">{trade.symbol}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">{trade.shares} shares</span>
                        <span className="font-mono">@ ${trade.price.toFixed(2)}</span>
                        {trade.pnl !== undefined && (
                          <span className={trade.pnl >= 0 ? 'pos-gain' : 'pos-loss'}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </span>
                        )}
                        <span className="text-slate-500 text-xs">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-4 space-y-6">
          {/* Selected Agent Detail */}
          {selectedAgent ? (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl">{selectedAgent.avatar}</div>
                <div>
                  <h3 className="text-2xl font-bold">{selectedAgent.name}</h3>
                  <p className="text-slate-400">{selectedAgent.personality}</p>
                  <p className="text-xs text-slate-500 mt-1">Generation {selectedAgent.generation}</p>
                </div>
              </div>

              {/* Portfolio Value Chart */}
              {selectedAgent.portfolio?.history && selectedAgent.portfolio.history.length > 1 && (
                <div className="h-40 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedAgent.portfolio.history}>
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                      <Tooltip 
                        contentStyle={{ background: '#1a1a24', border: 'none', borderRadius: '8px' }}
                        labelFormatter={(v) => new Date(v).toLocaleString()}
                        formatter={(v: number) => ['$' + v.toFixed(2), 'Value']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={selectedAgent.color} 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Holdings */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Cash</span>
                  <span className="font-mono">${selectedAgent.portfolio?.cash.toFixed(2) || '0.00'}</span>
                </div>
                
                <div className="text-sm text-slate-400 mt-4 mb-2">Positions</div>
                {selectedAgent.portfolio?.positions && Object.keys(selectedAgent.portfolio.positions).length > 0 ? (
                  Object.entries(selectedAgent.portfolio.positions).map(([symbol, pos]) => (
                    <div key={symbol} className="flex justify-between items-center p-2 bg-slate-800/30 rounded">
                      <span className="font-mono font-medium">{symbol}</span>
                      <div className="text-right text-sm">
                        <div>{pos.shares} shares</div>
                        <div className="text-slate-500">avg ${pos.avgCost.toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-4">No positions</div>
                )}
              </div>

              <button 
                onClick={() => setSelectedAgent(null)}
                className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="glass rounded-2xl p-6 text-center">
              <Target className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400">Click an agent to see details</p>
            </div>
          )}

          {/* Graveyard */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Skull className="w-5 h-5 text-slate-400" />
              Graveyard
            </h3>
            
            {graveyard.length === 0 ? (
              <div className="text-center text-slate-500 py-4">
                <p>No casualties yet</p>
                <p className="text-xs mt-1">Elimination in {competition?.daysRemaining || '?'} days</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {graveyard.slice(0, 10).map((dead, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/30 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-lg opacity-50">{dead.avatar}</span>
                      <span className="text-sm">{dead.name} <span className="text-slate-500">G{dead.generation}</span></span>
                    </div>
                    <span className={`text-sm ${dead.finalReturn >= 0 ? 'pos-gain' : 'pos-loss'}`}>
                      {dead.finalReturn >= 0 ? '+' : ''}{dead.finalReturn?.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Arena Stats
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Agents</span>
                <span>7 active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Competition Round</span>
                <span>#{competition?.round || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Eliminations</span>
                <span>{graveyard.length} all-time</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Trades</span>
                <span>{trades.length}+</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-slate-500 text-sm">
        <p>StockRacer • AI agents trading with real market data • Paper money only</p>
      </footer>
    </div>
  );
}
