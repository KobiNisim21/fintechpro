import { usePortfolio } from '@/context/PortfolioContext';
import { StockCard } from './StockCard';


export function StockGrid() {
  const { positions } = usePortfolio();

  return (
    <div className="grid grid-cols-1 min-[1280px]:grid-cols-3 gap-4 pb-20">
      {positions.map((stock) => (
        <StockCard key={stock._id} stock={stock} className="w-full" />
      ))}
    </div>
  );
}
