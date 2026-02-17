import { usePortfolio } from '@/context/PortfolioContext';
import { StockCard } from './StockCard';


export function StockGrid() {
  const { positions } = usePortfolio();

  return (
    <>
      {/* Mobile/Tablet Grid (visible below 1280px) */}
      <div className="xl:hidden">
        <div className="grid grid-cols-1 gap-4 pb-20">
          {positions.map((stock) => (
            <StockCard key={stock._id} stock={stock} className="w-full" />
          ))}
        </div>
      </div>

      <div className="hidden xl:block">
        <div className="flex flex-wrap gap-4 pb-20">
          {positions.map((stock) => (
            <StockCard key={stock._id} stock={stock} className="w-72 shrink-0" />
          ))}
        </div>
      </div>
    </>
  );
}
