import { usePortfolio } from '@/context/PortfolioContext';
import { StockCard } from './StockCard';


export function StockGrid() {
  const { positions } = usePortfolio();

  return (
    <div className="grid grid-cols-1 xl:flex xl:flex-wrap gap-4 pb-20">
      {positions.map((stock) => (
        <StockCard key={stock._id} stock={stock} className="w-full xl:w-72 xl:shrink-0" />
      ))}
    </div>
  );
}
