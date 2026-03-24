import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { stocksAPI } from '@/api/stocks';

export function PortfolioChart() {
  const { positions, loading: positionsLoading } = usePortfolio();
  const [historyData, setHistoryData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
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
    const fetchHistory = async () => {
      if (positions.length === 0) {
        setHistoryData([]);
        return;
      }

      setLoading(true);
      try {
        // 1. Fetch Exchange Rate
        const forexData = await stocksAPI.getForexRate();
        const exchangeRate = forexData.rate || 3.6; // Fallback to 3.6 if API fails

        // 2. Setup Date Range
        const to = Math.floor(Date.now() / 1000);
        const from = to - (30 * 24 * 60 * 60); // 30 days ago

        // 3. Fetch history for all positions
        const historyPromises = positions.map(pos =>
          stocksAPI.getStockHistory(pos.symbol, from, to, 'D')
            .then(data => ({ symbol: pos.symbol, data }))
            .catch(err => {
              console.error(`Failed to fetch history for ${pos.symbol}`, err);
              return { symbol: pos.symbol, data: { c: [], t: [] } }; // Return empty on fail
            })
        );

        const results = await Promise.all(historyPromises);

        // 4. Aggregate data by date
        // Fix for 2x Spike Bug: If Yahoo returns multiple ticks for the same calendar day (e.g., due to timezone crossing),
        // we overwrite the value per symbol instead of summing it twice.
        const symbolValuesByDate = new Map<number, Map<string, number>>();
        
        results.forEach(({ symbol, data }) => {
          const position = positions.find(p => p.symbol === symbol);
          if (!position || !data.c || !data.t) return;

          data.t.forEach((timestamp: number, index: number) => {
            // Normalize timestamp to midnight to group same days
            const dateObj = new Date(timestamp * 1000);
            dateObj.setHours(0, 0, 0, 0);
            const normalizedTs = dateObj.getTime();

            // Calculate value in USD
            const valueUsd = data.c[index] * position.quantity;
            
            if (!symbolValuesByDate.has(normalizedTs)) {
               symbolValuesByDate.set(normalizedTs, new Map());
            }
            // Overwrites if multiple ticks on the same day exist for the same symbol
            symbolValuesByDate.get(normalizedTs)!.set(symbol, valueUsd);
          });
        });

        // Sum up the deduplicated latest value of each symbol per calendar day
        const timestampMap = new Map<number, number>();
        for (const [ts, symbolMap] of symbolValuesByDate.entries()) {
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
            date: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
        setLoading(false);
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

    return () => clearInterval(checkMarketClose);
    // Only refetch when positions are added/removed, not on price updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length]);

  if (loading || positionsLoading) {
    return (
      <div className="relative overflow-hidden rounded-[32px] bg-[var(--color-ios-card)] shadow-[var(--shadow-ios-card)] p-8 h-[450px] flex items-center justify-center">
        <div className="animate-clay-float rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-[var(--color-ios-card)] shadow-[var(--shadow-ios-card)] p-8 transition-transform hover:-translate-y-1 hover:shadow-[var(--shadow-ios-card)]Hover duration-300">
      <div className="relative z-10">
        <div className="mb-8">
          <h3 className="text-2xl font-bold  text-[var(--color-ios-fg)] mb-1">Portfolio Growth</h3>
          <p className="text-[13px] font-bold text-[var(--color-ios-secondary)] uppercase tracking-widest ">Last 30 Days Performance</p>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="var(--color-ios-secondary)"
                style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'var(--)' }}
                minTickGap={30}
              />
              <YAxis
                stroke="var(--color-ios-secondary)"
                style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'var(--)' }}
                tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-ios-card)',
                  border: 'none',
                  borderRadius: '20px',
                  boxShadow: 'var(--shadow-[var(--shadow-ios-card)])',
                  padding: '16px',
                }}
                labelStyle={{ color: 'var(--color-ios-fg)', fontWeight: '900', fontFamily: 'var(--)' }}
                itemStyle={{ color: '#10B981' }}
                formatter={(value: number) => `₪${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#10B981"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#10B981' }}
                fill="url(#colorValue)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-[var(--color-ios-secondary)]/20">
          <div>
            <p className="text-[11px] font-bold text-[var(--color-ios-secondary)] mb-1 uppercase tracking-widest ">Monthly Return</p>
            <p className={`text-2xl font-bold  tracking-tight ${stats.monthlyReturn >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stats.monthlyReturn >= 0 ? '+' : ''}{stats.monthlyReturn.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[var(--color-ios-secondary)] mb-1 uppercase tracking-widest ">Total Gain</p>
            <p className={`text-2xl font-bold  tracking-tight ${stats.totalGain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {stats.totalGain >= 0 ? '+' : ''}₪{Math.abs(stats.totalGain).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[var(--color-ios-secondary)] mb-1 uppercase tracking-widest ">Best Day</p>
            <p className="text-2xl font-bold  tracking-tight text-emerald-500">
              +₪{stats.bestDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
