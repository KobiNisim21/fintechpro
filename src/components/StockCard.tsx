import { TrendingUp, TrendingDown, Trash2, Edit2, Plus, X } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { usePortfolio, Position, Lot } from '@/context/PortfolioContext';
import { useState, useEffect } from 'react';
import { SimpleDialog } from './SimpleDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface StockCardProps {
  stock: Position;
  className?: string;
}

export function StockCard({ stock, className }: StockCardProps) {
  const { removePosition, updatePosition } = usePortfolio();
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit State
  const [lots, setLots] = useState<Lot[]>([]);
  const [newLot, setNewLot] = useState<Lot>({
    date: new Date().toISOString().split('T')[0],
    quantity: 0,
    price: 0
  });
  const [showAddLot, setShowAddLot] = useState(false);

  // Initialize lots when opening edit dialog
  useEffect(() => {
    if (editOpen) {
      if (stock.lots && stock.lots.length > 0) {
        setLots(stock.lots);
      } else {
        // Fallback for legacy positions without lots: Create a single lot from current aggregates
        setLots([{
          date: new Date().toISOString().split('T')[0], // Default to today/now if unknown
          quantity: stock.quantity,
          price: stock.averagePrice
        }]);
      }
    }
  }, [editOpen, stock]);

  const isPositive = stock.change >= 0;
  const chartData = stock.sparklineData.map((value) => ({ value }));

  const quantity = stock.quantity || 0;
  const avgPrice = stock.averagePrice || 0;
  const totalValue = quantity * stock.price;
  const totalReturn = (stock.price - avgPrice) * quantity;
  const totalReturnPercent = avgPrice > 0 ? ((stock.price - avgPrice) / avgPrice) * 100 : 0;
  const istotalReturnPositive = totalReturn >= 0;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Helper to update a specific lot in the list
  const updateLot = (index: number, field: keyof Lot, value: any) => {
    const updatedDislots = [...lots];
    updatedDislots[index] = {
      ...updatedDislots[index],
      [field]: value
    };
    setLots(updatedDislots);
  };

  const handleAddLot = () => {
    if (newLot.quantity > 0 && newLot.price >= 0) {
      setLots([...lots, { ...newLot }]);
      setNewLot({
        date: new Date().toISOString().split('T')[0],
        quantity: 0,
        price: 0
      });
      setShowAddLot(false);
    }
  };

  const removeLot = (index: number) => {
    const updated = lots.filter((_, i) => i !== index);
    setLots(updated);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stock._id) return;

    setLoading(true);
    try {
      if (lots.length === 0) {
        if (confirm("Removing all lots will delete the position. Continue?")) {
          await removePosition(stock._id);
        }
      } else {
        // Calculate expected totals based on the edited lots
        const totalQty = lots.reduce((acc, lot) => acc + Number(lot.quantity), 0);
        const totalCost = lots.reduce((acc, lot) => acc + (Number(lot.quantity) * Number(lot.price)), 0);
        const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;

        await updatePosition(
          stock._id,
          totalQty,
          avgPrice,
          lots
        );
      }
      setEditOpen(false);
    } catch (error) {
      console.error('Failed to update position:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate projected totals for Edit UI
  const projectTotalQty = lots.reduce((acc, lot) => acc + Number(lot.quantity), 0);
  const projectTotalCost = lots.reduce((acc, lot) => acc + (Number(lot.quantity) * Number(lot.price)), 0);
  const projectAvgPrice = projectTotalQty > 0 ? projectTotalCost / projectTotalQty : 0;

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
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/20 text-cyan-400 opacity-100 transition-all z-20"
                    title="Edit position"
                  >
                    <Edit2 className="w-4 h-4" />
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
                {/* Extended hours price */}
                {stock.marketStatus && stock.marketStatus !== 'regular' && stock.extendedPrice && (
                  <span className="text-sm font-medium" style={{ color: '#fb923c' }}>
                    {stock.marketStatus === 'pre-market' && 'PM'}
                    {stock.marketStatus === 'after-hours' && 'AH'}
                    {stock.marketStatus === 'closed' && 'AH'}
                    {' $'}{stock.extendedPrice.toFixed(2)}
                  </span>
                )}
                {/* Market status badge */}
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

              <div className={`flex items-center gap-2 text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-500'}`}>
                <span>{isPositive ? '+' : ''}${stock.change.toFixed(2)}</span>
                <span>({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)</span>
                {stock.marketStatus && stock.marketStatus !== 'regular' && !stock.extendedPrice && (
                  <span className="text-white/40 font-normal ml-1">at close</span>
                )}
              </div>

              {/* Extended hours change */}
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

      {/* Edit Dialog - Multi-Lot Support */}
      <SimpleDialog open={editOpen} onClose={() => setEditOpen(false)}>
        <div className="max-h-[80vh] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">Edit {stock.symbol} Holdings</h2>

          <div className="space-y-4">
            {/* Lots List */}
            <div className="space-y-2">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 items-center text-xs text-white/50 px-2">
                <span>Date</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="w-8"></span>
              </div>
              {lots.map((lot, index) => (
                <div key={index} className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 items-center bg-white/5 p-2 rounded-lg border border-white/5 text-sm">
                  {/* Date Input - Editable */}
                  <Input
                    type="date"
                    value={typeof lot.date === 'string' ? lot.date.split('T')[0] : new Date(lot.date).toISOString().split('T')[0]}
                    onChange={(e) => updateLot(index, 'date', e.target.value)}
                    className="h-8 text-xs bg-transparent border-none focus-visible:ring-0 p-0 text-white/70 dark:scheme-dark"
                  />

                  {/* Quantity Input - Editable */}
                  <Input
                    type="number"
                    value={lot.quantity}
                    onChange={(e) => updateLot(index, 'quantity', Number(e.target.value))}
                    className="h-8 text-xs bg-transparent border-none focus-visible:ring-0 p-0 text-right font-medium text-white"
                  />

                  {/* Price Input - Editable */}
                  <Input
                    type="number"
                    value={lot.price}
                    onChange={(e) => updateLot(index, 'price', Number(e.target.value))}
                    className="h-8 text-xs bg-transparent border-none focus-visible:ring-0 p-0 text-right text-white/70"
                  />

                  <button
                    onClick={() => removeLot(index)}
                    className="w-8 flex justify-center text-white/30 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Lot Form */}
            {showAddLot ? (
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-3 animation-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/50">Date</Label>
                    <Input
                      type="date"
                      value={typeof newLot.date === 'string' ? newLot.date : new Date(newLot.date).toISOString().split('T')[0]}
                      onChange={(e) => setNewLot({ ...newLot, date: e.target.value })}
                      className="h-8 text-xs bg-white/5 border-white/10 dark:scheme-dark"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/50">Quantity</Label>
                    <Input
                      type="number"
                      value={newLot.quantity || ''}
                      onChange={(e) => setNewLot({ ...newLot, quantity: Number(e.target.value) })}
                      className="h-8 text-xs bg-white/5 border-white/10"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-white/50">Price per Share</Label>
                    <Input
                      type="number"
                      value={newLot.price || ''}
                      onChange={(e) => setNewLot({ ...newLot, price: Number(e.target.value) })}
                      className="h-8 text-xs bg-white/5 border-white/10"
                      placeholder="Price"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowAddLot(false)} className="h-7 text-xs">Cancel</Button>
                  <Button size="sm" onClick={handleAddLot} className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white">Add Lot</Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowAddLot(true)}
                variant="outline"
                className="w-full bg-white/5 border-dashed border-white/20 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/30"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Lot
              </Button>
            )}

            {/* Summary */}
            <div className="pt-4 border-t border-white/10 mt-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-white/50">Total Shares</span>
                <span className="font-bold text-white">{projectTotalQty}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/50">Avg Price</span>
                <span className="font-bold text-white">${projectAvgPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                onClick={() => setEditOpen(false)}
                className="bg-white/10 hover:bg-white/15 text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleEditSubmit}
                disabled={loading}
                className="bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </SimpleDialog>
    </>
  );
}
