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
      // Only set if we haven't already (or if we want to reset on open)
      // We use a simple check: if we are opening, we sync with current stock state.
      // But we MUST NOT react to 'stock' changes while already open.

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
        className={`group relative overflow-hidden rounded-[32px] bg-[var(--color-clay-card-bg)] border border-white/60 backdrop-blur-xl shadow-clayDeep hover:-translate-y-2 transition-all duration-500 cursor-pointer ${className || ''} ${isNear52wLow ? 'ring-2 ring-inset ring-amber-400' : ''}`}
      >

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* Stock Logo */}
              <div className="w-12 h-12 rounded-[24px] bg-gradient-to-br from-violet-400 to-violet-600 shadow-clayOrb flex items-center justify-center font-black text-sm text-white font-display shrink-0">
                {stock.symbol.slice(0, 2)}
              </div>
              <div>
                <h3 className="font-black text-[var(--color-clay-fg)] text-lg truncate max-w-[120px] font-display leading-tight">{stock.symbol}</h3>
                <p className="text-[13px] font-bold text-[var(--color-clay-muted)] truncate max-w-[120px] font-display">{stock.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 mr-1">
              {isPositive ? (
                <TrendingUp className="w-5 h-5 text-[var(--color-clay-success)]" />
              ) : (
                <TrendingDown className="w-5 h-5 text-[var(--color-clay-danger)]" />
              )}
              {stock._id && (
                <>
                  <button
                    onClick={handleEdit}
                    className="p-2 ml-1 rounded-[16px] bg-white/60 shadow-clayOrb hover:shadow-clayCard hover:-translate-y-1 active:scale-[0.92] active:shadow-clayPressed text-[var(--color-clay-sky)] transition-all z-20"
                    title="Edit position"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 ml-1 rounded-[16px] bg-white/60 shadow-clayOrb hover:shadow-clayCard hover:-translate-y-1 active:scale-[0.92] active:shadow-clayPressed text-rose-400 hover:text-rose-600 transition-all z-20"
                    title="Remove position"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Price & Daily Change */}
          <div className="mb-5 flex justifyContent-between items-end">
            <div>
              <div className="text-3xl font-black text-[var(--color-clay-fg)] mb-1 flex items-baseline gap-2 font-display tracking-tight">
                <span>${stock.price.toFixed(2)}</span>
                {/* Extended hours price */}
                {stock.marketStatus && stock.marketStatus !== 'regular' && stock.extendedPrice && (
                  <span className="text-[15px] font-bold text-[var(--color-clay-muted)] font-display tracking-normal">
                    {stock.marketStatus === 'pre-market' && 'PM'}
                    {stock.marketStatus === 'after-hours' && 'AH'}
                    {stock.marketStatus === 'closed' && 'AH'}
                    {' $'}{stock.extendedPrice.toFixed(2)}
                  </span>
                )}
                {/* Market status badge */}
                {stock.marketStatus && stock.marketStatus !== 'regular' && !stock.extendedPrice && (
                  <span className="text-[11px] font-black px-2 py-1.5 rounded-full uppercase tracking-widest font-display" style={{
                    backgroundColor: stock.marketStatus === 'closed' ? '#EFEBF5' : '#FEF3C7',
                    color: stock.marketStatus === 'closed' ? '#635F69' : '#D97706'
                  }}>
                    {stock.marketStatus === 'pre-market' && 'Pre-market'}
                    {stock.marketStatus === 'after-hours' && 'After-hours'}
                    {stock.marketStatus === 'closed' && 'Market Closed'}
                  </span>
                )}
              </div>

              <div className={`flex items-center gap-2 text-[14px] font-black font-display tracking-wide ${isPositive ? 'text-[var(--color-clay-success)]' : 'text-[var(--color-clay-danger)]'}`}>
                <span>{isPositive ? '+' : ''}${stock.change.toFixed(2)}</span>
                <span>({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)</span>
                {stock.marketStatus && stock.marketStatus !== 'regular' && !stock.extendedPrice && (
                  <span className="text-[var(--color-clay-muted)] font-bold ml-1 uppercase text-[10px] tracking-widest">at close</span>
                )}
              </div>

              {/* Extended hours change */}
              {stock.marketStatus && stock.marketStatus !== 'regular' && stock.extendedPrice && stock.extendedChange !== undefined && (
                <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: '11px', color: 'var(--color-clay-muted)' }}>
                  <span className="font-bold opacity-80">
                    {stock.marketStatus === 'pre-market' && 'Pre-market:'}
                    {stock.marketStatus === 'after-hours' && 'After-hours:'}
                    {stock.marketStatus === 'closed' && 'After-hours:'}
                  </span>
                  <span className={`font-black ${stock.extendedChange >= 0 ? 'text-[var(--color-clay-success)]' : 'text-[var(--color-clay-danger)]'}`}>
                    {stock.extendedChange >= 0 ? '+' : ''}${stock.extendedChange.toFixed(2)} ({stock.extendedChange >= 0 ? '+' : ''}{stock.extendedChangePercent?.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Position Details */}
          {quantity > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-5 p-4 bg-[var(--color-clay-input-bg)] shadow-clayPressed rounded-[24px]">
              <div>
                <p className="text-[11px] font-bold text-[var(--color-clay-muted)] mb-1 uppercase tracking-widest font-display">Holdings</p>
                <p className="text-[15px] font-black text-[var(--color-clay-fg)] font-display tracking-tight">{quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-[12px] font-bold text-[var(--color-clay-muted)]">Shares</span></p>
                <p className="text-[13px] font-bold text-[var(--color-clay-muted)]">Avg: ${avgPrice.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-[var(--color-clay-muted)] mb-1 uppercase tracking-widest font-display">Total Value</p>
                <p className="text-[15px] font-black text-[var(--color-clay-fg)] font-display tracking-tight">${totalValue.toFixed(2)}</p>
                <p className={`text-[13px] font-bold tracking-tight ${istotalReturnPositive ? 'text-[var(--color-clay-success)]' : 'text-[var(--color-clay-danger)]'}`}>
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

          {/* Special Insights Footer */}
          {(formattedEarnings || isNear52wLow) && (
            <div className="flex items-center gap-3 pt-4 border-t border-[var(--color-clay-input-bg)] text-[12px] font-bold font-display mt-2">
              {isNear52wLow && (
                <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full shadow-clayOrb">
                  <TrendingDown className="w-4 h-4" />
                  Buying Opportunity (Near 52W Low)
                </div>
              )}
              {formattedEarnings && (
                <div className="text-[var(--color-clay-muted)]">
                  Next Earnings: <span className="text-[var(--color-clay-fg)] font-black">{formattedEarnings}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog - Multi-Lot Support */}
      <SimpleDialog open={editOpen} onClose={() => setEditOpen(false)}>
        <div className="max-h-[80vh] overflow-y-auto px-1 pb-2">
          <h2 className="text-2xl font-black mb-6 font-display text-[var(--color-clay-fg)]">Edit {stock.symbol} Holdings</h2>

          <div className="space-y-6">
            {/* Lots List */}
            <div className="space-y-3 bg-[var(--color-clay-input-bg)] p-4 rounded-[32px] shadow-clayPressed">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 items-center text-[12px] font-bold text-[var(--color-clay-muted)] px-3 uppercase tracking-widest font-display">
                <span>Date</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="w-8"></span>
              </div>
              {lots.map((lot, index) => (
                <div key={index} className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 items-center bg-[var(--color-clay-card-bg)] p-2 rounded-[20px] shadow-clayOrb text-sm transition-transform hover:-translate-y-0.5">
                  {/* Date Input - Editable */}
                  <Input
                    type="date"
                    value={typeof lot.date === 'string' ? lot.date.split('T')[0] : new Date(lot.date).toISOString().split('T')[0]}
                    onChange={(e) => updateLot(index, 'date', e.target.value)}
                    className="h-9 text-[13px] bg-transparent border-none focus-visible:ring-0 p-1 text-[var(--color-clay-fg)] font-bold scheme-light"
                  />

                  {/* Quantity Input - Editable */}
                  <Input
                    type="number"
                    step="any"
                    value={lot.quantity}
                    onChange={(e) => updateLot(index, 'quantity', e.target.value)}
                    className="h-9 text-[14px] bg-transparent border-none focus-visible:ring-0 p-1 text-right font-black text-[var(--color-clay-fg)] font-display"
                  />

                  {/* Price Input - Editable */}
                  <Input
                    type="number"
                    value={lot.price}
                    onChange={(e) => updateLot(index, 'price', e.target.value)}
                    className="h-9 text-[14px] bg-transparent border-none focus-visible:ring-0 p-1 text-right font-bold text-[var(--color-clay-fg)] font-display"
                  />

                  <button
                    onClick={() => removeLot(index)}
                    className="w-10 h-10 flex items-center justify-center rounded-[16px] text-rose-400 hover:text-rose-600 hover:bg-rose-50 active:scale-[0.92] transition-all"
                  >
                    <X className="w-5 h-5" strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Lot Form */}
            {showAddLot ? (
              <div className="bg-[var(--color-clay-canvas)] p-5 rounded-[24px] shadow-clayOrb space-y-4 animation-fade-in border-2 border-white/50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[11px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display ml-1 mb-1 block">Date</Label>
                    <Input
                      type="date"
                      value={typeof newLot.date === 'string' ? newLot.date : new Date(newLot.date).toISOString().split('T')[0]}
                      onChange={(e) => setNewLot({ ...newLot, date: e.target.value })}
                      className="h-11 rounded-[16px] text-[14px] bg-[var(--color-clay-input-bg)] border-none shadow-clayPressed text-[var(--color-clay-fg)] font-bold px-4 scheme-light"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display ml-1 mb-1 block">Quantity</Label>
                    <Input
                      type="number"
                      step="any"
                      value={newLot.quantity !== undefined ? newLot.quantity : ''}
                      onChange={(e) => setNewLot({ ...newLot, quantity: e.target.value as unknown as number })}
                      className="h-11 rounded-[16px] text-[14px] bg-[var(--color-clay-input-bg)] border-none shadow-clayPressed text-[var(--color-clay-fg)] font-black font-display px-4 placeholder:text-black/20"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[11px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display ml-1 mb-1 block">Price per Share</Label>
                    <Input
                      type="number"
                      step="any"
                      value={newLot.price !== undefined ? newLot.price : ''}
                      onChange={(e) => setNewLot({ ...newLot, price: e.target.value as unknown as number })}
                      className="h-11 rounded-[16px] text-[14px] bg-[var(--color-clay-input-bg)] border-none shadow-clayPressed text-[var(--color-clay-fg)] font-black font-display px-4 placeholder:text-black/20"
                      placeholder="Price"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => setShowAddLot(false)} className="h-10 px-4 rounded-[16px] text-[13px] font-bold text-[var(--color-clay-muted)] active:scale-[0.92] transition-transform">Cancel</Button>
                  <Button size="sm" onClick={handleAddLot} className="h-10 px-5 rounded-[16px] text-[13px] font-black font-display bg-emerald-100 text-emerald-700 shadow-clayOrb hover:shadow-clayCard hover:-translate-y-1 active:scale-[0.92] transition-all">Add Lot</Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setShowAddLot(true)}
                variant="outline"
                className="w-full h-14 bg-[var(--color-clay-input-bg)] shadow-clayInset border-none text-[var(--color-clay-muted)] font-bold rounded-[24px] hover:bg-white hover:shadow-clayOrb active:scale-[0.92] active:shadow-clayPressed transition-all duration-300"
              >
                <Plus className="w-5 h-5 mr-2" strokeWidth={3} />
                Add Another Lot
              </Button>
            )}

            {/* Summary */}
            <div className="pt-4 mt-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[12px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display">Total Shares</span>
                <span className="text-lg font-black text-[var(--color-clay-fg)] font-display tracking-tight">{projectTotalQty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display">Avg Price</span>
                <span className="text-lg font-black text-[var(--color-clay-fg)] font-display tracking-tight">${projectAvgPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-8">
              <Button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-[20px] bg-[var(--color-clay-input-bg)] shadow-clayInset text-[var(--color-clay-muted)] hover:text-[var(--color-clay-fg)] hover:bg-[#E5E0EF] font-bold h-12 px-8 active:scale-[0.92] transition-all duration-200 border-none"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleEditSubmit}
                disabled={loading}
                className="rounded-[20px] bg-gradient-to-br from-violet-400 to-violet-600 shadow-clayButton hover:shadow-clayButtonHover active:shadow-clayPressed active:scale-[0.92] text-white font-bold font-display tracking-wide h-12 px-8 transition-all duration-200 border-none disabled:opacity-50 disabled:active:scale-100"
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
