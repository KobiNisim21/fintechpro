import { t, useLanguage, locale } from '@/i18n';
import { useEffect, useState, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { stocksAPI } from '@/api/stocks';

export function PortfolioHero() {
    useLanguage();
  const [usdToIls, setUsdToIls] = useState(3.6); // Default fallback
  const [forexSource, setForexSource] = useState('Estimated exchange rate');
  const { positions, portfolioAnalytics } = usePortfolio();
  const hasEstimates = positions.some(p => p.priceStatus === 'estimated');
  const hasPreviousQuotes = positions.some(p => p.priceStatus === 'stale');

  // Fetch USD/ILS exchange rate
  useEffect(() => {
    const fetchForexRate = async () => {
      try {
        const forexData = await stocksAPI.getForexRate();
        if (forexData.rate) {
          setUsdToIls(forexData.rate);
          setForexSource(forexData.source === 'last-known' ? 'Last known exchange rate' : forexData.source);
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
    <section className="data-panel portfolio-overview" aria-label={t('Portfolio Overview')}>
      <header className="overview-header">
        <h2>{t('Portfolio Overview')}</h2>
        <span className="overview-status">{hasEstimates ? t('Includes estimates') : hasPreviousQuotes ? t('Previous quotes') : t('Market data')}</span>
      </header>
      <div className="overview-ledger">
        <div className="overview-balances">
          <div className="overview-balance"><bdi dir="ltr" className="hero-balance-ils">₪{totalValueILS.toLocaleString(locale(), { maximumFractionDigits: 0 })}</bdi><span className="overview-currency">ILS</span></div>
          <div className="overview-balance"><bdi dir="ltr" className="hero-balance-usd">${totalValueUSD.toLocaleString(locale(), { maximumFractionDigits: 2 })}</bdi><span className="overview-currency">USD</span></div>
        </div>
        <dl className="overview-results">
          <div><dt>{t('TODAY')}</dt><dd className={isDailyPositive ? 'is-positive' : 'is-negative'}>
            <bdi dir="ltr">{isDailyPositive ? '+' : ''}₪{dailyChangeILS.toLocaleString(locale(), { maximumFractionDigits: 2 })}</bdi>
            <bdi dir="ltr" className="overview-secondary-value">{isDailyPositive ? '+' : ''}${dailyChangeUSD.toLocaleString(locale(), { maximumFractionDigits: 2 })} ({dailyChangePercent.toFixed(2)}%)</bdi>
          </dd></div>
          <div><dt>{t('Unrealized gain / loss')}</dt><dd className={isTotalPositive ? 'is-positive' : 'is-negative'}>
            <bdi dir="ltr">{isTotalPositive ? '+' : '-'}₪{Math.abs(totalGainILS).toLocaleString(locale(), { maximumFractionDigits: 2 })}</bdi>
            <bdi dir="ltr" className="overview-secondary-value">{isTotalPositive ? '+' : '-'}${Math.abs(totalGainUSD).toLocaleString(locale(), { maximumFractionDigits: 2 })} ({isTotalPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%)</bdi>
          </dd></div>
        </dl>
      </div>
      <footer className="overview-footer">
        <div className="overview-forex"><span>USD/ILS</span><bdi dir="ltr"><strong>{usdToIls.toFixed(4)}</strong></bdi><span className="price-freshness" title={t(forexSource)}>{t(forexSource)}</span></div>
        {periodReturns && <dl className="overview-periods">
          {([{ label: '1W Return', value: periodReturns.weekly }, { label: '1M Return', value: periodReturns.monthly }, { label: '1Y Return', value: periodReturns.yearly }]).map(({ label, value }) => <div key={label}>
            <dt>{t(label)}</dt><dd className={value >= 0 ? 'is-positive' : 'is-negative'}><bdi dir="ltr">{value >= 0 ? '+' : ''}{value.toFixed(1)}%</bdi></dd>
          </div>)}
        </dl>}
      </footer>
    </section>
  );
}
