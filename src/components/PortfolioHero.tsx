import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { stocksAPI } from '@/api/stocks';

// Extracted pulse animation into its own component to prevent
// 1-second re-renders of the entire PortfolioHero
function PulseDot() {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={`w-2 h-2 rounded-full bg-emerald-400 transition-opacity duration-300 ${pulse ? 'opacity-100' : 'opacity-30'}`} />
  );
}

export function PortfolioHero() {
  const [usdToIls, setUsdToIls] = useState(3.6); // Default fallback
  const { positions, portfolioAnalytics } = usePortfolio();

  // Fetch USD/ILS exchange rate
  useEffect(() => {
    const fetchForexRate = async () => {
      try {
        const forexData = await stocksAPI.getForexRate();
        if (forexData.rate) {
          setUsdToIls(forexData.rate);
        }
      } catch (error) {
        console.error('Failed to fetch forex rate, using fallback:', error);
      }
    };

    fetchForexRate();
    const interval = setInterval(fetchForexRate, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Combined memoization: single loop for all portfolio totals
  const { totalValueUSD, totalCostUSD, dailyChangeUSD } = useMemo(() => {
    let value = 0, cost = 0, change = 0;
    for (const pos of positions) {
      value += pos.price * pos.quantity;
      cost += pos.averagePrice * pos.quantity;
      change += pos.change * pos.quantity;
    }
    return { totalValueUSD: value, totalCostUSD: cost, dailyChangeUSD: change };
  }, [positions]);

  // Derive all other values (cheap, no need for separate memo)
  const totalGainUSD = totalValueUSD - totalCostUSD;
  const totalGainPercent = totalCostUSD > 0 ? (totalGainUSD / totalCostUSD) * 100 : 0;
  const dailyChangePercent = totalValueUSD > 0 ? (dailyChangeUSD / (totalValueUSD - dailyChangeUSD)) * 100 : 0;
  const totalValueILS = totalValueUSD * usdToIls;
  const dailyChangeILS = dailyChangeUSD * usdToIls;
  const isDailyPositive = dailyChangeUSD >= 0;
  const isTotalPositive = totalGainUSD >= 0;

  // ── Compute Weekly / Monthly / Yearly returns from benchmarkData ──
  const periodReturns = useMemo(() => {
    const bd = portfolioAnalytics?.benchmarkData;
    if (!bd || bd.length < 2) return null;

    const latest = bd[bd.length - 1].portfolio; // latest TWR cumulative %

    const getReturn = (daysAgo: number) => {
      const idx = Math.max(0, bd.length - 1 - daysAgo);
      const past = bd[idx].portfolio;
      // Convert cumulative values: relative return = ((1+latest/100)/(1+past/100)-1)*100
      const rel = ((1 + latest / 100) / (1 + past / 100) - 1) * 100;
      return rel;
    };

    return {
      weekly: getReturn(5),   // ~5 trading days
      monthly: getReturn(22), // ~22 trading days
      yearly: getReturn(252), // ~252 trading days (or full history if less)
    };
  }, [portfolioAnalytics?.benchmarkData]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/20 via-[#1a1a1f]/80 to-cyan-500/20 backdrop-blur-2xl border border-white/10 p-6 md:p-8">
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Total Portfolio Value</h3>
              <div className="flex items-center gap-2">
                <PulseDot />
                <span className="text-xs text-emerald-400 font-medium">LIVE</span>
              </div>
            </div>

            {/* ILS Primary */}
            <div className="mb-3">
              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-bold text-white">
                  ₪{totalValueILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xl text-white/40">ILS</span>
              </div>
            </div>

            {/* USD Secondary */}
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-2xl font-semibold text-white/60">
                ${totalValueUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
              <span className="text-sm text-white/30">USD</span>
            </div>

            {/* Daily Change */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isDailyPositive
                ? 'bg-emerald-500/20 border-emerald-400/30'
                : 'bg-rose-500/20 border-rose-400/30'
                }`}>
                {isDailyPositive ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
                <span className={`font-semibold ${isDailyPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isDailyPositive ? '+' : ''}₪{dailyChangeILS.toLocaleString('en-US', { maximumFractionDigits: 2 })} ({dailyChangePercent.toFixed(2)}%)
                </span>
              </div>
              <span className="text-sm text-white/50">Today</span>
            </div>

            {/* Total Gain/Loss */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-white/40">Total Gain/Loss:</span>
              <span className={`text-sm font-semibold ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isTotalPositive ? '+' : ''}₪{(totalGainUSD * usdToIls).toLocaleString('en-US', { maximumFractionDigits: 2 })} / ${totalGainUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })} ({totalGainPercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* ── Right Column: Returns + Activity/Exchange ── */}
          <div className="flex flex-col items-end gap-4">
            {/* Activity Indicator & Exchange Rate */}
            <div className="flex items-center gap-3">
              <div className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                <Activity className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 min-w-[80px]">
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">USD/ILS</div>
                <div className="text-base font-bold text-white/90">{usdToIls.toFixed(4)}</div>
              </div>
            </div>

            {/* ── Period Returns (Weekly / Monthly / Yearly) ── */}
            {periodReturns && (
              <div className="flex flex-row gap-3">
                {([
                  { label: '1W', value: periodReturns.weekly },
                  { label: '1M', value: periodReturns.monthly },
                  { label: '1Y', value: periodReturns.yearly },
                ] as const).map(({ label, value }) => {
                  const isPositive = value >= 0;
                  return (
                    <div
                      key={label}
                      className={`flex flex-col items-center px-4 py-3 rounded-2xl border backdrop-blur-md min-w-[80px] ${isPositive
                        ? 'bg-emerald-500/10 border-emerald-400/20'
                        : 'bg-rose-500/10 border-rose-400/20'
                        }`}
                    >
                      <span className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{label} Return</span>
                      <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{value.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
