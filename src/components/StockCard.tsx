import { TrendingUp, TrendingDown, Trash2, Edit2, Plus, X } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { usePortfolio, Position, Lot } from '@/context/PortfolioContext';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { SimpleDialog } from './SimpleDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface StockCardProps {
  stock: Position;
  className?: string;
}

export const StockCard = memo(function StockCard({ stock, className }: StockCardProps) {
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
  // FIX: Race Condition - Only initialize when opening. Do NOT re-initialize if 'stock' updates while open.
  useEffect(() => {
    if (editOpen) {
      if (stock.lots && stock.lots.length > 0) {
        setLots(stock.lots);
      } else {
        // Fallback for legacy positions without lots
        setLots([{
          date: new Date().toISOString().split('T')[0],
          quantity: stock.quantity || 0,
          price: stock.averagePrice || 0
        }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen]); // REMOVED 'stock' dependency to prevent overwrite during background refresh

  const isPositive = stock.change >= 0;
  const chartData = useMemo(() => stock.sparklineData.map((value) => ({ value })), [stock.sparklineData]);

  const quantity = stock.quantity || 0;
  const avgPrice = stock.averagePrice || 0;
  const totalValue = quantity * stock.price;
  const totalReturn = (stock.price - avgPrice) * quantity;
  const totalReturnPercent = avgPrice > 0 ? ((stock.price - avgPrice) / avgPrice) * 100 : 0;
  const istotalReturnPositive = totalReturn >= 0;

  // Visual Alert Logic
  const isNear52wLow = stock.fiftyTwoWeekLow && (stock.price <= stock.fiftyTwoWeekLow * 1.05);

  // Memoize earnings date parsing to avoid expensive work on every render
  const formattedEarnings = useMemo(() => {
    if (!stock.nextEarningsDate) return null;
    try {
      let parsedDate: Date;
      const rawVal = stock.nextEarningsDate as string | number;

      if (typeof rawVal === 'number' || (typeof rawVal === 'string' && /^\d+$/.test(rawVal))) {
        const ts = Number(rawVal);
        parsedDate = new Date(ts > 1e11 ? ts : ts * 1000);
      } else {
        parsedDate = new Date(rawVal);
      }

      if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const compareDate = new Date(parsedDate);
        compareDate.setHours(0, 0, 0, 0);

        if (compareDate >= today) {
          return parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
      }
    } catch (e) {
      // Silently ignore parse errors
    }
    return null;
  }, [stock.nextEarningsDate]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (stock._id) {
      if (confirm(`Are you sure you want to delete ${stock.symbol}?`)) {
        removePosition(stock._id);
      }
    }
  }, [stock._id, stock.symbol, removePosition]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditOpen(true);
  }, []);

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
    if (!stock._id || loading) return; // Prevent double-submit

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

        // STRICT PAYLOAD: Ensure dates are valid ISO strings to prevent backend merging/shifting
        const strictLots = lots.map(lot => ({
          quantity: Number(lot.quantity),
          price: Number(lot.price),
          date: typeof lot.date === 'string' ? lot.date : new Date(lot.date).toISOString()
        }));

        await updatePosition(
          stock._id,
          totalQty,
          avgPrice,
          strictLots
        );
      }
      setEditOpen(false);
    } catch (error) {
      console.error('Failed to update position:', error);
      alert('Failed to save changes. Please try again.');
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
        className={`glass-card-solid rounded-2xl hover-lift cursor-pointer ${className || ''} ${isNear52wLow ? 'ring-2 ring-inset ring-amber-400' : ''}`}
      >

        <div className="relative z-10 p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-bold text-slate-800 text-base">{stock.symbol}</h3>
              <p className="text-[13px] font-medium text-slate-500 truncate max-w-[120px]">{stock.name}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-[10px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </span>
              {stock._id && (
                <>
                  <button
                    onClick={handleEdit}
                    className="p-1.5 ml-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all z-20"
                    title="Edit position"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all z-20"
                    title="Remove position"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="mb-2">
            <div className="text-sm font-semibold text-slate-700 flex items-baseline gap-2">
              <span>${stock.price.toFixed(2)}</span>
              {/* Extended hours price */}
              {stock.marketStatus && stock.marketStatus !== 'regular' && stock.extendedPrice && (
                <span className="text-[11px] font-medium text-slate-400">
                  {stock.marketStatus === 'pre-market' && 'PM'}
                  {stock.marketStatus === 'after-hours' && 'AH'}
                  {stock.marketStatus === 'closed' && 'AH'}
                  {' $'}{stock.extendedPrice.toFixed(2)}
                </span>
              )}
              {/* Market status badge */}
              {stock.marketStatus && stock.marketStatus !== 'regular' && !stock.extendedPrice && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider" style={{
                  backgroundColor: stock.marketStatus === 'closed' ? '#f1f5f9' : '#FEF3C7',
                  color: stock.marketStatus === 'closed' ? '#64748b' : '#D97706'
                }}>
                  {stock.marketStatus === 'pre-market' && 'Pre-market'}
                  {stock.marketStatus === 'after-hours' && 'After-hours'}
                  {stock.marketStatus === 'closed' && 'Closed'}
                </span>
              )}
            </div>

            <div className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isPositive ? '+' : ''}${stock.change.toFixed(2)} ({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)
              {stock.marketStatus && stock.marketStatus !== 'regular' && !stock.extendedPrice && (
                <span className="text-slate-400 font-medium ml-1 uppercase text-[9px]">at close</span>
              )}
            </div>

            {/* Extended hours change */}
            {stock.marketStatus && stock.marketStatus !== 'regular' && stock.extendedPrice && stock.extendedChange !== undefined && (
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                <span className="font-medium">
                  {stock.marketStatus === 'pre-market' && 'Pre-market:'}
                  {stock.marketStatus === 'after-hours' && 'After-hours:'}
                  {stock.marketStatus === 'closed' && 'After-hours:'}
                </span>
                <span className={`font-semibold ${stock.extendedChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {stock.extendedChange >= 0 ? '+' : ''}${stock.extendedChange.toFixed(2)} ({stock.extendedChange >= 0 ? '+' : ''}{stock.extendedChangePercent?.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>

          {/* Sparkline Chart */}
          <div className="h-[30px] w-full mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? '#10b981' : '#e11d48'}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Market Status Label */}
          {stock.marketStatus && stock.marketStatus !== 'regular' && (
            <div className="text-[9px] text-slate-400 font-medium uppercase mb-2">
              {stock.marketStatus === 'pre-market' && 'Pre-market INFO'}
              {stock.marketStatus === 'after-hours' && 'After-hours INFO'}
              {stock.marketStatus === 'closed' && 'Pre-market INFO'}
              {!stock.marketStatus && 'Pre-market INFO'}
            </div>
          )}

          {/* Position Details — compact like reference */}
          {quantity > 0 && (
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Shares</span>
                <span className="font-semibold text-slate-700">{quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Total Value</span>
                <span className="font-semibold text-slate-700">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Special Insights Footer */}
          {(formattedEarnings || isNear52wLow) && (
            <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 text-[11px] font-medium mt-3">
              {isNear52wLow && (
                <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Near 52W Low
                </div>
              )}
              {formattedEarnings && (
                <div className="text-slate-500">
                  Next Earnings: <span className="text-slate-800 font-semibold">{formattedEarnings}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog - Multi-Lot Support */}
      <SimpleDialog open={editOpen} onClose={() => setEditOpen(false)}>
        <div className="max-h-[80vh] overflow-y-auto px-1 pb-2">
          <h2 className="text-2xl font-bold mb-6 text-slate-800">Edit {stock.symbol} Holdings</h2>

          <div className="space-y-6">
            {/* Lots List */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 items-center text-[11px] font-semibold text-slate-500 px-3 uppercase tracking-wider">
                <span>Date</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="w-8"></span>
              </div>
              {lots.map((lot, index) => (
                <div key={index} className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 items-center glass-card-solid p-2 rounded-xl text-sm hover-lift">
                  {/* Date Input - Editable */}
                  <Input
                    type="date"
                    value={typeof lot.date === 'string' ? lot.date.split('T')[0] : new Date(lot.date).toISOString().split('T')[0]}
                    onChange={(e) => updateLot(index, 'date', e.target.value)}
                    className="h-9 text-[13px] bg-transparent border-none focus-visible:ring-0 p-1 text-slate-800 font-medium scheme-light"
                  />

                  {/* Quantity Input - Editable */}
                  <Input
                    type="number"
                    step="any"
                    value={lot.quantity}
                    onChange={(e) => updateLot(index, 'quantity', e.target.value)}
                    className="h-9 text-[14px] bg-transparent border-none focus-visible:ring-0 p-1 text-right font-bold text-slate-800"
                  />

                  {/* Price Input - Editable */}
                  <Input
                    type="number"
                    value={lot.price}
                    onChange={(e) => updateLot(index, 'price', e.target.value)}
                    className="h-9 text-[14px] bg-transparent border-none focus-visible:ring-0 p-1 text-right font-semibold text-slate-800"
                  />

                  <button
                    onClick={() => removeLot(index)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <X className="w-5 h-5" strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Lot Form */}
            {showAddLot ? (
              <div className="bg-slate-50 p-5 rounded-2xl space-y-4 border border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Date</Label>
                    <Input
                      type="date"
                      value={typeof newLot.date === 'string' ? newLot.date : new Date(newLot.date).toISOString().split('T')[0]}
                      onChange={(e) => setNewLot({ ...newLot, date: e.target.value })}
                      className="h-11 rounded-xl text-[14px] bg-white border border-slate-200 text-slate-800 font-medium px-4 scheme-light"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Quantity</Label>
                    <Input
                      type="number"
                      step="any"
                      value={newLot.quantity !== undefined ? newLot.quantity : ''}
                      onChange={(e) => setNewLot({ ...newLot, quantity: e.target.value as unknown as number })}
                      className="h-11 rounded-xl text-[14px] bg-white border border-slate-200 text-slate-800 font-bold px-4 placeholder:text-slate-300"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Price per Share</Label>
                    <Input
                      type="number"
                      step="any"
                      value={newLot.price !== undefined ? newLot.price : ''}
                      onChange={(e) => setNewLot({ ...newLot, price: e.target.value as unknown as number })}
                      className="h-11 rounded-xl text-[14px] bg-white border border-slate-200 text-slate-800 font-bold px-4 placeholder:text-slate-300"
                      placeholder="Price"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowAddLot(false)} className="h-10 px-4 rounded-xl text-[13px] font-medium text-slate-500 transition-colors">Cancel</Button>
                  <Button size="sm" onClick={handleAddLot} className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">Add Lot</Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowAddLot(true)}
                variant="outline"
                className="w-full h-14 bg-slate-50 border border-slate-200 text-slate-500 font-medium rounded-2xl hover:bg-white hover:border-slate-300 transition-all duration-300"
              >
                <Plus className="w-5 h-5 mr-2" strokeWidth={2} />
                Add Another Lot
              </Button>
            )}

            {/* Summary */}
            <div className="pt-4 mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Total Shares</span>
                <span className="text-lg font-bold text-slate-800 tracking-tight">{projectTotalQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Avg Price</span>
                <span className="text-lg font-bold text-slate-800 tracking-tight">${projectAvgPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8">
              <Button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl bg-slate-100 text-slate-600 hover:text-slate-800 hover:bg-slate-200 font-medium h-12 px-8 transition-all duration-200 border-none"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleEditSubmit}
                disabled={loading}
                className="rounded-xl bg-slate-800 text-white font-semibold tracking-wide h-12 px-8 hover:bg-slate-900 transition-all duration-200 border-none disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </SimpleDialog>
    </>
  );
});
