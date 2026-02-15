import { usePortfolio } from '@/context/PortfolioContext';
import { StockCard } from './StockCard';


export function StockGrid() {
  const { positions } = usePortfolio();

  return (
    <div className="flex flex-wrap gap-4 justify-start pb-20">
      {positions.map((stock) => (
        <StockCard key={stock._id} stock={stock} />
      ))}
    </div>
  );
}
