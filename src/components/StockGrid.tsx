import { usePortfolio } from '@/context/PortfolioContext';
import { StockCard } from './StockCard';


export function StockGrid() {
  const { positions } = usePortfolio();

  return (
    <>
      {/* Mobile/Tablet Grid (visible below 1280px) */}
      <div className="grid grid-cols-1 gap-4 pb-20 xl:hidden">
        {positions.map((stock) => (
          <StockCard key={stock._id} stock={stock} className="w-full" />
        ))}
      </div>

      {/* Desktop Grid (visible above 1280px) - Restoring 3 column layout */}
      <div className="hidden xl:grid xl:grid-cols-3 gap-4 pb-20">
        {positions.map((stock) => (
          <StockCard key={stock._id} stock={stock} className="w-full" />
        ))}
      </div>
    </>
  );
}
