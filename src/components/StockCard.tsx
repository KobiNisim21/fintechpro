import { TrendingUp, TrendingDown, Trash2, Edit2 } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { usePortfolio } from '@/context/PortfolioContext';
import { useState } from 'react';
import { SimpleDialog } from './SimpleDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface StockCardProps {
  stock: {
    _id?: string;
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    sparklineData: number[];
    color: string;
    quantity?: number;
    averagePrice?: number;

    // Extended hours data (pre-market or after-hours)
    extendedPrice?: number;
    extendedChange?: number;
    extendedChangePercent?: number;
    marketStatus?: 'regular' | 'pre-market' | 'after-hours' | 'closed';
  };
  className?: string;
}

export function StockCard({ stock, className }: StockCardProps) {
  const { removePosition, updatePosition } = usePortfolio();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    quantity: stock.quantity?.toString() || '',
    averagePrice: stock.averagePrice?.toString() || '',
  });
  const [loading, setLoading] = useState(false);

  const isPositive = stock.change >= 0;
  const chartData = stock.sparklineData.map((value) => ({ value }));

  // Calculate position metrics if available
  const quantity = stock.quantity || 0;
  const avgPrice = stock.averagePrice || 0;
  const totalValue = quantity * stock.price;
  const totalReturn = (stock.price - avgPrice) * quantity;
  const totalReturnPercent = avgPrice > 0 ? ((stock.price - avgPrice) / avgPrice) * 100 : 0;
  const istotalReturnPositive = totalReturn >= 0;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (stock._id) {
      if (confirm(`Are you sure you want to delete ${stock.symbol}?`)) {
        removePosition(stock._id);
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stock._id) return;

    setLoading(true);
    try {
      await updatePosition(
        stock._id,
        Number(editForm.quantity),
        Number(editForm.averagePrice)
      );
      setEditOpen(false);
    } catch (error) {
      console.error('Failed to update position:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        data-ticker={stock.symbol}
        className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 p-4 pr-12 hover:border-white/20 hover:from-white/15 hover:to-white/10 transition-all cursor-pointer ${className || ''}`}
      >
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Stock Logo */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/20 to-white/10 flex items-center justify-center font-bold text-sm text-white border border-white/20">
                {stock.symbol.slice(0, 2)}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm truncate max-w-[120px]">{stock.symbol}</h3>
                <p className="text-xs text-white/50 truncate max-w-[120px]">{stock.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 mr-1">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-500" />
              )}
              {stock._id && (
                <>
                  <button
                    onClick={handleEdit}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-cyan-400 transition-colors z-20"
                    title="Edit position"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-rose-400 transition-colors z-20"
                    title="Remove position"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Price & Daily Change */}
          <div className="mb-4 flex justifyContent-between items-end">
            <div>
              <div className="text-2xl font-bold text-white mb-1 flex items-baseline gap-2">
                <span>${stock.price.toFixed(2)}</span>
                {/* Extended hours price from Yahoo Finance */}
                {stock.marketStatus && stock.marketStatus !== 'regular' && stock.extendedPrice && (
                  <span className="text-sm font-medium" style={{ color: '#fb923c' }}>
                    {stock.marketStatus === 'pre-market' && 'PM'}
                    {stock.marketStatus === 'after-hours' && 'AH'}
                    {stock.marketStatus === 'closed' && 'AH'}
                    {' $'}{stock.extendedPrice.toFixed(2)}
                  </span>
                )}
                {/* Market status badge when no extended price available */}
                {stock.marketStatus && stock.marketStatus !== 'regular' && !stock.extendedPrice && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{
                    backgroundColor: stock.marketStatus === 'closed' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(251, 146, 60, 0.2)',
                    color: stock.marketStatus === 'closed' ? '#9ca3af' : '#fb923c'
                  }}>
                    {stock.marketStatus === 'pre-market' && 'Pre-market'}
                    {stock.marketStatus === 'after-hours' && 'After-hours'}
                    {stock.marketStatus === 'closed' && 'Market Closed'}
                  </span>
                )}
              </div>
              {/* Regular market change */}
              <div className={`flex items-center gap-2 text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-500'}`}>
                <span>{isPositive ? '+' : ''}${stock.change.toFixed(2)}</span>
                <span>({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)</span>
                {stock.marketStatus && stock.marketStatus !== 'regular' && !stock.extendedPrice && (
                  <span className="text-white/40 font-normal ml-1">at close</span>
                )}
              </div>

              {/* Extended hours change from Yahoo Finance */}
              {stock.marketStatus && stock.marketStatus !== 'regular' && stock.extendedPrice && stock.extendedChange !== undefined && (
                <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: '11px', color: 'rgba(251, 146, 60, 0.9)' }}>
                  <span style={{ color: 'rgba(251, 146, 60, 0.6)' }}>
                    {stock.marketStatus === 'pre-market' && 'Pre-market:'}
                    {stock.marketStatus === 'after-hours' && 'After-hours:'}
                    {stock.marketStatus === 'closed' && 'After-hours:'}
                  </span>
                  <span>{stock.extendedChange >= 0 ? '+' : ''}${stock.extendedChange.toFixed(2)}</span>
                  <span>({stock.extendedChange >= 0 ? '+' : ''}{stock.extendedChangePercent?.toFixed(2)}%)</span>
                </div>
              )}
            </div>
          </div>

          {/* Position Details */}
          {quantity > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
              <div>
                <p className="text-xs text-white/40 mb-0.5">Holdings</p>
                <p className="text-sm font-medium text-white">{quantity} Shares</p>
                <p className="text-xs text-white/40">Avg: ${avgPrice.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40 mb-0.5">Total Value</p>
                <p className="text-sm font-bold text-white">${totalValue.toFixed(2)}</p>
                <p className={`text-xs ${istotalReturnPositive ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {istotalReturnPositive ? '+' : ''}{totalReturn.toFixed(2)} ({totalReturnPercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          )}

          {/* Sparkline Chart */}
          <div className="h-12 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={stock.color}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <SimpleDialog open={editOpen} onClose={() => setEditOpen(false)}>
        <div>
          <h2 className="text-xl font-semibold mb-2">Edit Position</h2>
          <p className="text-sm text-white/60 mb-4">Update your holdings for {stock.symbol}</p>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-quantity" className="text-white/70 mb-2">Quantity</Label>
              <Input
                id="edit-quantity"
                type="number"
                step="any"
                className="bg-white/5 border-white/10 text-white"
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-avgPrice" className="text-white/70 mb-2">Average Price</Label>
              <Input
                id="edit-avgPrice"
                type="number"
                step="any"
                className="bg-white/5 border-white/10 text-white"
                value={editForm.averagePrice}
                onChange={(e) => setEditForm({ ...editForm, averagePrice: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                onClick={() => setEditOpen(false)}
                className="bg-white/10 hover:bg-white/15 text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </SimpleDialog>
    </>
  );
}
