import { useState, useEffect } from 'react';
import { Plus, X, Check, ChevronsUpDown } from 'lucide-react';
import { SimpleDialog } from './SimpleDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePortfolio } from '@/context/PortfolioContext';
import { stocksAPI } from '@/api/stocks';
import { cn } from '@/components/ui/utils';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export function AddPositionDialog() {
    const { addPosition } = usePortfolio();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        symbol: '',
        name: '',
        quantity: '',
        averagePrice: '',
        date: new Date().toISOString().split('T')[0], // Default to today
    });

    // Search state
    const [openCombobox, setOpenCombobox] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    // Debounced search with AbortController and result merging
    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const delayDebounceFn = setTimeout(async () => {
            if (searchValue && searchValue.length > 1) {
                setSearching(true);
                try {
                    const results = await stocksAPI.search(searchValue, { signal: controller.signal });
                    if (!isMounted) return;

                    // Keep valid local results in case API returns empty or was rate-limited
                    setSearchResults(prev => {
                        const existingIsraeli = prev.filter(s =>
                            s.israeliData &&
                            (s.symbol.toLowerCase().includes(searchValue.toLowerCase()) ||
                                (s.description || '').toLowerCase().includes(searchValue.toLowerCase()))
                        );

                        // Merge strategy: Local matches first, then API matches
                        const all = [...existingIsraeli, ...(results || [])];
                        const seen = new Set();
                        const finalResults = all.filter(s => {
                            if (!s || !s.symbol) return false;
                            if (seen.has(s.symbol)) return false;
                            seen.add(s.symbol);
                            return true;
                        });

                        // Priority: Israeli matches at the top
                        return finalResults.sort((a, b) => {
                            if (a.israeliData && !b.israeliData) return -1;
                            if (!a.israeliData && b.israeliData) return 1;
                            return 0; // maintain original relative order otherwise
                        });
                    });
                } catch (err: any) {
                    if (err?.name === 'CanceledError' || err?.message === 'canceled') {
                        // Ignored aborted network request
                        return;
                    }
                    console.error('Search failed', err);
                    if (isMounted) {
                        // DO NOT clear the results state. Keep the localMatches visible.
                        setSearchResults(prev => prev.filter(s => s.israeliData));
                    }
                } finally {
                    if (isMounted) {
                        setSearching(false);
                    }
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => {
            isMounted = false;
            controller.abort();
            clearTimeout(delayDebounceFn);
        };
    }, [searchValue]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await addPosition(
                formData.symbol,
                formData.name || `${formData.symbol.toUpperCase()} Inc.`,
                Number(formData.quantity),
                Number(formData.averagePrice),
                new Date(formData.date) // Pass the date
            );

            setFormData({
                symbol: '',
                name: '',
                quantity: '',
                averagePrice: '',
                date: new Date().toISOString().split('T')[0]
            });
            setSearchValue('');
            setOpen(false);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to add position');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                className="rounded-[20px] bg-white shadow-clayOrb hover:shadow-clayCard hover:-translate-y-1 active:scale-[0.92] active:shadow-clayPressed text-[var(--color-clay-fg)] font-bold px-6 h-12 transition-all duration-300"
            >
                <Plus className="w-5 h-5 mr-2" strokeWidth={2.5} />
                <span className="font-display tracking-wide">Add Position</span>
            </Button>

            <SimpleDialog open={open} onClose={() => setOpen(false)}>
                <div className="relative px-2">
                    <button
                        onClick={() => setOpen(false)}
                        className="absolute -top-2 -right-2 w-10 h-10 flex items-center justify-center rounded-[16px] text-[var(--color-clay-muted)] hover:text-rose-500 hover:bg-rose-50 active:scale-[0.92] transition-all"
                    >
                        <X className="w-5 h-5" strokeWidth={2.5} />
                    </button>

                    <h2 className="text-2xl font-black font-display text-[var(--color-clay-fg)] mb-2">
                        Add New Position
                    </h2>
                    <p className="text-[14px] font-bold text-[var(--color-clay-muted)] mb-8">
                        Enter the details of the stock you want to add to your portfolio.
                    </p>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {error && (
                            <div className="p-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-[16px] text-sm font-bold shadow-sm">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                            <Label htmlFor="symbol" className="text-[12px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display text-right block">Symbol</Label>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between h-12 rounded-[16px] bg-[var(--color-clay-input-bg)] shadow-clayPressed border-none text-[var(--color-clay-fg)] font-bold px-4 hover:bg-[var(--color-clay-input-bg)] hover:text-[var(--color-clay-fg)] active:scale-[0.98]"
                                    >
                                        {formData.symbol
                                            ? formData.symbol
                                            : "Search stock..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-2 bg-[var(--color-clay-canvas)] border-none rounded-[24px] shadow-clayDeep text-[var(--color-clay-fg)] z-[10010]">
                                    <Command className="bg-transparent" shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Search symbol..."
                                            value={searchValue}
                                            onValueChange={setSearchValue}
                                            className="text-[var(--color-clay-fg)] font-bold placeholder-[var(--color-clay-muted)]"
                                        />
                                        <CommandList className="max-h-[300px] overflow-y-auto w-full custom-scrollbar">
                                            <CommandEmpty className="py-6 text-center text-[13px] font-bold text-[var(--color-clay-muted)]">
                                                {searching ? 'Searching...' : 'No stock found.'}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {searchResults.map((stock) => (
                                                    <CommandItem
                                                        key={stock.symbol}
                                                        value={stock.symbol}
                                                        onSelect={(_) => {
                                                            setFormData({
                                                                ...formData,
                                                                symbol: stock.symbol, // Use exact symbol from API
                                                                name: stock.description
                                                            });
                                                            setOpenCombobox(false);
                                                        }}
                                                        className="text-[var(--color-clay-fg)] aria-selected:bg-[var(--color-clay-fg)]/5 cursor-pointer rounded-[12px] my-1 data-[selected=true]:bg-[var(--color-clay-fg)]/10"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.symbol === stock.symbol ? "opacity-100 text-emerald-500" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black font-display">{stock.displaySymbol}</span>
                                                                {stock.israeliData && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-blue-100 text-blue-600 font-bold whitespace-nowrap">
                                                                        {stock.israeliData.type === 'fund' ? 'קרן כספית 🇮🇱' : 'TASE 🇮🇱'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[12px] text-[var(--color-clay-muted)] font-bold">{stock.description}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                            <Label htmlFor="date" className="text-[12px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display text-right block">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                className="h-12 rounded-[16px] bg-[var(--color-clay-input-bg)] shadow-clayPressed border-none text-[var(--color-clay-fg)] font-bold px-4 scheme-light focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                            <Label htmlFor="name" className="text-[12px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display text-right block">Name</Label>
                            <Input
                                id="name"
                                className="h-12 rounded-[16px] bg-[var(--color-clay-input-bg)] shadow-clayPressed border-none text-[var(--color-clay-fg)] font-bold px-4 placeholder:text-black/20 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                placeholder="Apple Inc. (optional)"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                            <Label htmlFor="quantity" className="text-[12px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display text-right block">Quantity</Label>
                            <Input
                                id="quantity"
                                type="number"
                                step="any"
                                className="h-12 rounded-[16px] bg-[var(--color-clay-input-bg)] shadow-clayPressed border-none text-[var(--color-clay-fg)] font-black font-display px-4 placeholder:text-black/20 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                placeholder="10"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                            <Label htmlFor="avgPrice" className="text-[12px] font-bold text-[var(--color-clay-muted)] uppercase tracking-widest font-display text-right block">Avg Price</Label>
                            <Input
                                id="avgPrice"
                                type="number"
                                step="any"
                                className="h-12 rounded-[16px] bg-[var(--color-clay-input-bg)] shadow-clayPressed border-none text-[var(--color-clay-fg)] font-black font-display px-4 placeholder:text-black/20 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                placeholder="150.00"
                                value={formData.averagePrice}
                                onChange={(e) => setFormData({ ...formData, averagePrice: e.target.value })}
                                required
                            />
                        </div>

                        <div className="flex justify-end mt-4">
                            <Button type="submit" disabled={loading} className="rounded-[20px] bg-gradient-to-br from-violet-400 to-violet-600 shadow-clayButton hover:shadow-clayButtonHover active:shadow-clayPressed active:scale-[0.92] text-white font-bold font-display tracking-wide h-12 px-8 transition-all duration-200 border-none disabled:opacity-50 disabled:active:scale-100">
                                {loading ? 'Adding...' : 'Add Stock'}
                            </Button>
                        </div>
                    </form>
                </div>
            </SimpleDialog>
        </>
    );
}
