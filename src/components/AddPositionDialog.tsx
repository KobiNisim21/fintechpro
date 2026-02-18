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

    // Debounced search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchValue && searchValue.length > 1) {
                setSearching(true);
                try {
                    const results = await stocksAPI.search(searchValue);
                    setSearchResults(results);
                } catch (err) {
                    console.error('Search failed', err);
                    setSearchResults([]);
                } finally {
                    setSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
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
                className="bg-white/10 hover:bg-white/20 text-white border border-white/10 shadow-lg backdrop-blur-sm transition-all duration-300"
            >
                <Plus className="w-4 h-4" />
                Add Position
            </Button>

            <SimpleDialog open={open} onClose={() => setOpen(false)}>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setOpen(false)}
                        style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.7)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'white';
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
                        Add New Position
                    </h2>
                    <p style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '16px' }}>
                        Enter the details of the stock you want to add to your portfolio.
                    </p>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {error && (
                            <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#f87171', fontSize: '14px' }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: '16px' }}>
                            <Label htmlFor="symbol" className="text-right text-white/70">Symbol</Label>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
                                    >
                                        {formData.symbol
                                            ? formData.symbol
                                            : "Search stock..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0 bg-[#1a1a1f] border-white/10 text-white">
                                    <Command className="bg-transparent">
                                        <CommandInput
                                            placeholder="Search symbol..."
                                            value={searchValue}
                                            onValueChange={setSearchValue}
                                            className="text-white"
                                        />
                                        <CommandList>
                                            <CommandEmpty>
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
                                                        className="text-white aria-selected:bg-white/10 cursor-pointer"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.symbol === stock.symbol ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="font-bold">{stock.displaySymbol}</span>
                                                            <span className="text-xs text-white/50">{stock.description}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: '16px' }}>
                            <Label htmlFor="date" className="text-right text-white/70">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                className="bg-white/5 border-white/10 text-white dark:scheme-dark"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: '16px' }}>
                            <Label htmlFor="name" className="text-right text-white/70">Name</Label>
                            <Input
                                id="name"
                                className="bg-white/5 border-white/10 text-white"
                                placeholder="Apple Inc. (optional)"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: '16px' }}>
                            <Label htmlFor="quantity" className="text-right text-white/70">Quantity</Label>
                            <Input
                                id="quantity"
                                type="number"
                                step="any"
                                className="bg-white/5 border-white/10 text-white"
                                placeholder="10"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'center', gap: '16px' }}>
                            <Label htmlFor="avgPrice" className="text-right text-white/70">Avg Price</Label>
                            <Input
                                id="avgPrice"
                                type="number"
                                step="any"
                                className="bg-white/5 border-white/10 text-white"
                                placeholder="150.00"
                                value={formData.averagePrice}
                                onChange={(e) => setFormData({ ...formData, averagePrice: e.target.value })}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <Button type="submit" disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50">
                                {loading ? 'Adding...' : 'Add Stock'}
                            </Button>
                        </div>
                    </form>
                </div>
            </SimpleDialog>
        </>
    );
}
