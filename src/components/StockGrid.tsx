import { usePortfolio } from '@/context/PortfolioContext';
import { StockCard } from './StockCard';
import { AddPositionDialog } from './AddPositionDialog';

export function StockGrid() {
  const { positions } = usePortfolio();

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AddPositionDialog />
      </div>
      <div className="flex flex-wrap gap-4 justify-start pb-20" style={{ flexWrap: 'wrap' }}>
        {positions.map((stock) => (
          <StockCard key={stock._id} stock={stock} />
        ))}
      </div>
    </div>
  );
}
