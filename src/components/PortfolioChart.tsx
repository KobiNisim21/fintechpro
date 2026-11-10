import { t, useLanguage, locale } from '@/i18n';
import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { stocksAPI } from '@/api/stocks';

export function PortfolioChart() {
    useLanguage();
  const { positions, loading: positionsLoading } = usePortfolio();
  const [historyData, setHistoryData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const compositionKey = positions.map(p => `${p._id}:${p.symbol}:${p.quantity}:${p.averagePrice}`).sort().join(',');
  const [stats, setStats] = useState({
    totalGain: 0,
    monthlyReturn: 0,
    bestDay: 0,
  });

  // Calculate totals in USD first
  const portfolioTotalUsd = useMemo(() => {
    return positions.reduce((sum, pos) => sum + (pos.price * pos.quantity), 0);
  }, [positions]);

  const totalCostUsd = useMemo(() => {
    return positions.reduce((sum, pos) => sum + (pos.averagePrice * pos.quantity), 0);
  }, [positions]);

  useEffect(() => {
    let cancelled = false;
    const fetchHistory = async () => {
      if (positions.length === 0) {
        setHistoryData([]);
        return;
      }

      setLoading(true);
      try {
        // 2. Setup Date Range
        const to = Math.floor(Date.now() / 60000) * 60;
        const from = to - (30 * 24 * 60 * 60); // 30 days ago

        const quantities = new Map<string, number>();
        positions.forEach(p => quantities.set(p.symbol, (quantities.get(p.symbol) || 0) + p.quantity));
        const [forexData, histories] = await Promise.all([
          stocksAPI.getForexRate(),
          stocksAPI.getBatchHistory([...quantities.keys()], from, to),
        ]);
        if (cancelled) return;
        const exchangeRate = forexData.rate;
        if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('Exchange rate unavailable');
        const results = Object.entries(histories).map(([symbol, data]) => ({ symbol, data }));

        // 4. Aggregate data by date
        // Fix for 2x Spike Bug: If Yahoo returns multiple ticks for the same calendar day (e.g., due to timezone crossing),
        // we overwrite the value per symbol instead of summing it twice.
        const symbolValuesByDate = new Map<number, Map<string, number>>();
        
        results.forEach(({ symbol, data }) => {
          const quantity = quantities.get(symbol);
          if (!quantity || !data.c || !data.t) return;

          data.t.forEach((timestamp: number, index: number) => {
            // Normalize timestamp to midnight to group same days
            const dateObj = new Date(timestamp * 1000);
            dateObj.setHours(0, 0, 0, 0);
            const normalizedTs = dateObj.getTime();

            // Calculate value in USD
            const divisor = data.currency === 'ILA' ? 100 * exchangeRate : data.currency === 'ILS' ? exchangeRate : 1;
            const valueUsd = (data.c[index] * quantity) / divisor;
            if (!Number.isFinite(valueUsd)) return;
            
            if (!symbolValuesByDate.has(normalizedTs)) {
               symbolValuesByDate.set(normalizedTs, new Map());
            }
            // Overwrites if multiple ticks on the same day exist for the same symbol
            symbolValuesByDate.get(normalizedTs)!.set(symbol, valueUsd);
          });
        });

        // Sum up the deduplicated latest value of each symbol per calendar day
        const timestampMap = new Map<number, number>();
        const coveredSymbols = results.filter(r => r.data.c?.length > 0).length;
        for (const [ts, symbolMap] of symbolValuesByDate.entries()) {
           if (symbolMap.size !== coveredSymbols) continue;
           let totalDayValue = 0;
           for (const val of symbolMap.values()) {
              totalDayValue += val;
           }
           timestampMap.set(ts, totalDayValue);
        }

        // 5. Convert to Sorted Array and Apply Exchange Rate
        const sortedData = Array.from(timestampMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([ts, valueUsd]) => ({
            date: new Date(ts).toISOString(),
            value: valueUsd * exchangeRate // Convert to NIS
          }));

        setHistoryData(sortedData);

        // 6. Calculate stats
        if (sortedData.length > 0) {
          const startValue = sortedData[0].value;
          const endValue = sortedData[sortedData.length - 1].value;

          // Calculate stats in NIS
          const totalCostNis = totalCostUsd * exchangeRate;
          const currentTotalNis = portfolioTotalUsd * exchangeRate;

          const totalGain = currentTotalNis - totalCostNis;
          const monthlyReturn = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0;

          // Best Day (already in NIS)
          let maxDailyGain = 0;
          for (let i = 1; i < sortedData.length; i++) {
            const gain = sortedData[i].value - sortedData[i - 1].value;
            if (gain > maxDailyGain) maxDailyGain = gain;
          }

          setStats({
            totalGain,
            monthlyReturn,
            bestDay: maxDailyGain
          });
        }

      } catch (err) {
        console.error('Error calculating portfolio history:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();

    // Check every minute if market just closed (4:00 PM ET), and if so, refresh
    const checkMarketClose = setInterval(() => {
      const now = new Date();
      const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const hours = etTime.getHours();
      const minutes = etTime.getMinutes();
      const day = etTime.getDay();

      // Refresh at market close: 4:00-4:05 PM ET on weekdays
      if (day >= 1 && day <= 5 && hours === 16 && minutes < 5) {
        console.log('📊 Market just closed, refreshing chart...');
        fetchHistory();
      }
    }, 60 * 1000); // Check every minute

    return () => { cancelled = true; clearInterval(checkMarketClose); };
    // Only refetch when positions are added/removed, not on price updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositionKey]);

  if (loading || positionsLoading) {
    return (
      <div className="portfolio-growth-chart bg-surface rounded-xl shadow-card p-card-sm md:p-card border border-line/50 h-[450px] flex items-center justify-center">
        <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-2 border-accent/30 border-t-accent"></div>
      </div>
    );
  }

  return (
    <div className="portfolio-growth-chart relative bg-surface rounded-xl shadow-card p-card-sm md:p-card border border-line/50 transition-shadow hover:shadow-card-hover duration-base">
      <div className="relative z-10">
        <div className="mb-5 space-y-1">
          <h3 className="text-subhead text-ink font-semibold mb-1">{t("Portfolio Growth")}</h3>
          <p className="text-caption text-secondary font-medium">{t("Last 30 Days Performance")}</p>
          <p className="text-caption text-secondary">{t("Historical value of today's holdings at the current exchange rate. Assets without history are excluded.")}</p>
        </div>

        <div className="growth-chart-area w-full h-[300px] md:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--app-positive)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--app-positive)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                tickFormatter={value => new Date(value).toLocaleDateString(locale(), { month: "short", day: "numeric" })}
                stroke="var(--color-ios-secondary)"
                style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'var(--app-font)' }}
                minTickGap={30}
              />
              <YAxis
                stroke="var(--color-ios-secondary)"
                style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--app-font)' }}
                tickFormatter={(value) => t('₪{0}K', [(value / 1000).toFixed(0)])}
                domain={['auto', 'auto']}
              />
              <Tooltip
                labelFormatter={value => new Date(value).toLocaleDateString(locale())}
                contentStyle={{
                  backgroundColor: 'var(--app-surface)',
                  border: '1px solid var(--app-line)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-ios-card)',
                  padding: '12px',
                }}
                labelStyle={{ color: 'var(--app-ink)', fontWeight: '600', fontFamily: 'var(--app-font)' }}
                itemStyle={{ color: 'var(--app-positive)' }}
                formatter={(value: number) => `₪${value.toLocaleString(locale(), { maximumFractionDigits: 0 })}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--app-positive)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: 'var(--app-positive)' }}
                fill="url(#colorValue)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="growth-metrics grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5 pt-5 border-t border-line">
          <div>
            <p className="text-caption text-secondary font-medium mb-1">{t("30-day price change")}</p>
            <p dir="ltr" className={`text-heading font-semibold tabular-nums tracking-tight ${stats.monthlyReturn >= 0 ? 'text-positive' : 'text-negative'}`}>
              {stats.monthlyReturn >= 0 ? '+' : ''}{stats.monthlyReturn.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-caption text-secondary font-medium mb-1">{t("Total Gain")}</p>
            <p dir="ltr" className={`text-heading font-semibold tabular-nums tracking-tight ${stats.totalGain >= 0 ? 'text-positive' : 'text-negative'}`}>
              {stats.totalGain >= 0 ? '+' : ''}₪{Math.abs(stats.totalGain).toLocaleString(locale(), { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-caption text-secondary font-medium mb-1">{t("Best Day")}</p>
            <p dir="ltr" className="text-heading font-semibold tabular-nums tracking-tight text-positive">
              +₪{stats.bestDay.toLocaleString(locale(), { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
