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
    <div className={`w-2 h-2 rounded-full bg-emerald-500 transition-opacity duration-300 ${pulse ? 'opacity-100' : 'opacity-30'}`} />
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
  const totalGainILS = totalGainUSD * usdToIls;
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
    <div className="glass-card rounded-[32px] md:rounded-[20px] p-8 relative overflow-hidden desktop-hero">
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Portfolio Overview</h3>
              <div className="flex items-center gap-2">
                <PulseDot />
                <span className="text-[13px] text-emerald-500 font-bold tracking-widest uppercase">LIVE</span>
              </div>
            </div>

            {/* ILS Primary — large balance number matching reference */}
            <div className="mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight text-slate-900 hero-balance-ils">
                  ₪{totalValueILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-2xl font-medium text-slate-500 hero-currency-label">ILS</span>
              </div>
            </div>

            {/* Daily Change */}
            <p className={`text-sm font-semibold mt-1 ${isDailyPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isDailyPositive ? '+' : ''}₪{dailyChangeILS.toLocaleString('en-US', { maximumFractionDigits: 2 })} ({dailyChangePercent.toFixed(2)}%)
              <span className="text-slate-400 font-normal ml-1">TODAY</span>
            </p>

            {/* USD Secondary */}
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900 hero-balance-usd">
                  ${totalValueUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
                <span className="text-lg font-medium text-slate-500 uppercase hero-currency-label">USD</span>
              </div>
            </div>

            {/* Total Gain/Loss */}
            <div className="mt-6 space-y-1">
              <p className={`text-sm font-medium ${isDailyPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isDailyPositive ? '+' : ''}${dailyChangeUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })} ({dailyChangePercent.toFixed(2)}%)
                <span className="text-slate-400 font-normal ml-1">TODAY</span>
              </p>
              <p className={`text-sm font-medium ${isTotalPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isTotalPositive ? '+' : ''}₪{Math.abs(totalGainILS).toLocaleString(undefined, { maximumFractionDigits: 2 })} /
                {isTotalPositive ? ' +$' : ' -$'}{Math.abs(totalGainUSD).toLocaleString(undefined, { maximumFractionDigits: 2 })} ({isTotalPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%)
              </p>
            </div>
          </div>

          {/* ── Right Column: Returns + Activity/Exchange ── */}
          <div className="flex flex-col items-end gap-5">
            {/* Activity Indicator & Exchange Rate */}
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full hover:bg-white/50 transition-colors">
                <Activity className="w-6 h-6 text-slate-600" strokeWidth={2} />
              </div>
              <div className="glass-card-solid rounded-2xl flex flex-col items-center justify-center p-4 min-w-[90px] hover-lift hero-exchange-card">
                <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-1">USD/ILS</div>
                <div className="text-lg font-bold text-slate-800 tracking-tight">{ usdToIls.toFixed(4)}</div>
              </div>
            </div>

            {/* ── Period Returns (Weekly / Monthly / Yearly) ── */}
            {periodReturns && (
              <div className="flex flex-row gap-3 mt-2">
                {([
                  { label: '1W', value: periodReturns.weekly },
                  { label: '1M', value: periodReturns.monthly },
                  { label: '1Y', value: periodReturns.yearly },
                ] as const).map(({ label, value }) => {
                  const isPositive = value >= 0;
                  return (
                    <div
                      key={label}
                      className={`glass-card-solid rounded-2xl flex flex-col items-center px-4 py-3.5 min-w-[85px] hover-lift hero-period-card ${isPositive
                        ? 'bg-emerald-50/80'
                        : 'bg-rose-50/80'
                        }`}
                    >
                      <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1.5 hero-period-label">{label} Return</span>
                      <span className={`text-xl font-bold tracking-tight hero-period-value ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
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
