import { t, useLanguage, errorText } from '@/i18n';
﻿import { useState, useEffect } from 'react';
import { Plus, Check, ChevronsUpDown } from 'lucide-react';
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

export function AddPositionDialog({ compact = false }: { compact?: boolean }) {
    useLanguage();
    const { addPosition } = usePortfolio();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        symbol: '',
        name: '',
        quantity: '',
        averagePrice: '',
        broker: 'Default',
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
                new Date(formData.date),
                formData.broker || 'Default'
            );

            setFormData({
                symbol: '',
                name: '',
                quantity: '',
                averagePrice: '',
                broker: 'Default',
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
                aria-label={t("Add Position")}
                onClick={() => setOpen(true)}
                className="primary-action rounded-xl bg-accent text-white font-semibold px-5 min-h-11 h-12 transition-colors duration-base"
            >
                <Plus className="w-5 h-5 me-2" strokeWidth={2.5} />
                <span className={compact ? "mobile-header-add-label" : "tracking-wide"}>{t("Add Position")}</span>
            </Button>

            <SimpleDialog open={open} onClose={() => setOpen(false)} title={t("Add new position")}>
                <div className="position-form-content relative">
                    <p className="text-caption text-secondary mb-5">
                        {t("Enter the details of the stock you want to add to your portfolio.")}</p>

                    <form onSubmit={handleSubmit} className="position-entry-form flex flex-col gap-5">
                        {error && (
                            <div className="p-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-sm font-bold shadow-sm">
                                {errorText(error)}
                            </div>
                        )}

                        <div className="position-form-row grid grid-cols-1 sm:grid-cols-[100px_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                            <Label htmlFor="symbol" className="text-[12px] font-medium text-secondary  text-end block">{t("Symbol")}</Label>
                            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCombobox}
                                        className="w-full justify-between h-12 rounded-lg bg-[var(--color-ios-input)] shadow-none border-none text-[var(--color-ios-fg)] font-bold px-4 hover:bg-[var(--color-ios-input)] hover:text-[var(--color-ios-fg)] active:scale-[0.98]"
                                    >
                                        {formData.symbol
                                            ? formData.symbol
                                            : t("Search stock...")}
                                        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="position-search-popover w-[300px] p-2 bg-surface border border-line rounded-xl shadow-modal text-ink z-[10010]">
                                    <Command className="bg-transparent" shouldFilter={false}>
                                        <CommandInput
                                            placeholder={t("Search symbol...")}
                                            value={searchValue}
                                            onValueChange={setSearchValue}
                                            className="text-[var(--color-ios-fg)] font-bold placeholder-[var(--color-ios-secondary)]"
                                        />
                                        <CommandList className="max-h-[300px] overflow-y-auto w-full custom-scrollbar">
                                            <CommandEmpty className="py-6 text-center text-[13px] font-bold text-[var(--color-ios-secondary)]">
                                                {searching ? t("Searching...") : t("No stock found.")}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {searchResults.map((stock) => (
                                                    <CommandItem
                                                        key={stock.symbol}
                                                        value={stock.symbol}
                                                        onSelect={async (_) => {
                                                            const sym = stock.symbol;
                                                            const desc = stock.description;
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                symbol: sym,
                                                                name: desc
                                                            }));
                                                            setOpenCombobox(false);

                                                            try {
                                                                const quote = await stocksAPI.getQuote(sym);
                                                                if (quote && typeof quote.c === 'number' && quote.c > 0) {
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        averagePrice: prev.averagePrice ? prev.averagePrice : String(quote.c.toFixed(2))
                                                                    }));
                                                                }
                                                            } catch {
                                                                // Quietly ignore if quote fetch fails
                                                            }
                                                        }}
                                                        className="text-[var(--color-ios-fg)] aria-selected:bg-[var(--color-ios-fg)]/5 cursor-pointer rounded-[12px] my-1 data-[selected=true]:bg-[var(--color-ios-fg)]/10"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "me-2 h-4 w-4",
                                                                formData.symbol === stock.symbol ? "opacity-100 text-emerald-500" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold ">{stock.displaySymbol}</span>
                                                                {stock.israeliData && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-[8px] bg-blue-100 text-blue-600 font-bold whitespace-nowrap">
                                                                        {stock.israeliData.type === 'fund' ? t("Israeli money market fund") : t("TASE")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[12px] text-[var(--color-ios-secondary)] font-bold">{stock.description}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="position-form-row grid grid-cols-1 sm:grid-cols-[100px_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                            <Label htmlFor="date" className="text-[12px] font-medium text-secondary  text-end block">{t("Date")}</Label>
                            <div className="position-date-control">
                                <Input
                                    id="date"
                                    type="date"
                                    className="position-date-input h-12 rounded-lg bg-[var(--color-ios-input)] shadow-none border-none text-[var(--color-ios-fg)] font-bold px-4 scheme-light focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="position-form-row grid grid-cols-1 sm:grid-cols-[100px_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                            <Label htmlFor="broker" className="text-[12px] font-medium text-secondary text-end block">{t("Broker")}</Label>
                            <Input
                                id="broker"
                                className="h-12 rounded-lg bg-[var(--color-ios-input)] shadow-none border-none text-[var(--color-ios-fg)] font-bold px-4 placeholder:text-black/20 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                placeholder={t("Default (or Blink, IBI...)")}
                                value={formData.broker}
                                onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                            />
                        </div>

                        <div className="position-form-row grid grid-cols-1 sm:grid-cols-[100px_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                            <Label htmlFor="name" className="text-[12px] font-medium text-secondary  text-end block">{t("Name")}</Label>
                            <Input
                                id="name"
                                className="h-12 rounded-lg bg-[var(--color-ios-input)] shadow-none border-none text-[var(--color-ios-fg)] font-bold px-4 placeholder:text-black/20 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                placeholder={t("Apple Inc. (optional)")}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="position-form-row grid grid-cols-1 sm:grid-cols-[100px_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                            <Label htmlFor="quantity" className="text-[12px] font-medium text-secondary  text-end block">{t("Quantity")}</Label>
                            <Input
                                id="quantity"
                                type="number"
                                step="any"
                                className="h-12 rounded-lg bg-[var(--color-ios-input)] shadow-none border-none text-[var(--color-ios-fg)] font-bold  px-4 placeholder:text-black/20 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                placeholder="10"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                required
                            />
                        </div>

                        <div className="position-form-row grid grid-cols-1 sm:grid-cols-[100px_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                            <Label htmlFor="avgPrice" className="text-[12px] font-medium text-secondary  text-end block">{t("Avg Price")}</Label>
                            <Input
                                id="avgPrice"
                                type="number"
                                step="any"
                                className="h-12 rounded-lg bg-[var(--color-ios-input)] shadow-none border-none text-[var(--color-ios-fg)] font-bold  px-4 placeholder:text-black/20 focus-visible:ring-emerald-500 focus-visible:ring-offset-0"
                                placeholder="150.00"
                                value={formData.averagePrice}
                                onChange={(e) => setFormData({ ...formData, averagePrice: e.target.value })}
                                required
                            />
                        </div>

                        <div className="flex justify-end mt-4">
                            <Button type="submit" disabled={loading} className="primary-action w-full rounded-xl bg-accent text-white font-semibold h-12 px-5 transition-colors duration-base disabled:opacity-50">
                                {loading ? t("Adding...") : t("Add Stock")}
                            </Button>
                        </div>
                    </form>
                </div>
            </SimpleDialog>
        </>
    );
}
