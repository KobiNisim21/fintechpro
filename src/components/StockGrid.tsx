import { usePortfolio } from '@/context/PortfolioContext';
import { StockCard } from './StockCard';


export function StockGrid() {
  const { positions } = usePortfolio();

  return (
    <>
      {/* Mobile/Tablet Grid (visible below 1280px) */}
      <div className="grid grid-cols-1 gap-4 pb-20 min-[1280px]:hidden">
        {positions.map((stock) => (
          <StockCard key={stock._id} stock={stock} className="w-full" />
        ))}
      </div>

      {/* Desktop Flex (visible above 1280px) */}
      <div className="hidden min-[1280px]:flex flex-wrap gap-4 justify-start pb-20">
        {positions.map((stock) => (
          <StockCard key={stock._id} stock={stock} className="w-auto" />
        ))}
      </div>
    </>
  );
}
