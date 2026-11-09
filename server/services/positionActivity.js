export const holdingSnapshot = position => ({
    quantity: position.quantity, averagePrice: position.averagePrice,
    broker: position.broker || 'Default', isDeleted: Boolean(position.isDeleted),
    lots: (position.lots || []).map(lot => ({ quantity: lot.quantity, price: lot.price, date: lot.date })),
});

export function legacyEvents(position) {
    const lots = position.lots?.length ? position.lots : [{ quantity: position.quantity, price: position.averagePrice, date: position.createdAt }];
    return lots.filter(lot => lot.quantity > 0).map(lot => ({
        type: 'OPENING', quantity: lot.quantity, price: lot.price, amount: lot.quantity * lot.price,
        occurredAt: lot.date || position.createdAt || new Date(), recordedAt: new Date(),
        broker: position.broker || 'Default', note: 'Reconstructed remaining lot; earlier sales and fees are unknown',
    }));
}

export function applySale(position, { quantity, price, fee = 0, date, note = '' }, { allowUnknownPrice = false } = {}) {
    const unknownPrice = allowUnknownPrice && price == null;
    const qty = Number(quantity), unitPrice = unknownPrice ? null : Number(price), charge = Number(fee);
    const occurredAt = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(Math.min(new Date(`${date}T23:59:59.999Z`).getTime(), Date.now()))
        : date ? new Date(date) : new Date();
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > new Date().toISOString().slice(0, 10)) throw new Error('Sale date cannot be in the future');
    if (quantity == null || quantity === '' || !Number.isFinite(qty) || qty <= 0 || qty > position.quantity) throw new Error('Sale quantity must be positive and cannot exceed the holding');
    if ((!unknownPrice && (price == null || price === '' || !Number.isFinite(unitPrice) || unitPrice < 0)) || !Number.isFinite(charge) || charge < 0) throw new Error('Price and fee must be finite non-negative numbers');
    if (!Number.isFinite(occurredAt.getTime()) || occurredAt > new Date()) throw new Error('Sale date must be valid and cannot be in the future');
    const lots = (position.lots?.length ? position.lots : [{ quantity: position.quantity, price: position.averagePrice, date: position.createdAt }]).map(lot => ({ quantity: lot.quantity, price: lot.price, date: lot.date })).sort((a, b) => new Date(a.date) - new Date(b.date));
    const latestMutation = Math.max(0, ...(position.activity || []).filter(event => ['SELL', 'ADJUSTMENT', 'RESTORE'].includes(event.type)).map(event => new Date(event.occurredAt).getTime()));
    if (lots.some(lot => new Date(lot.date) > occurredAt) || latestMutation > occurredAt.getTime()) throw new Error('Sale must follow recorded purchases and prior changes; use a correction for historical restatement');
    let remaining = qty, costBasis = 0;
    const nextLots = [];
    for (const lot of lots) {
        const consumed = Math.min(remaining, lot.quantity);
        remaining -= consumed;
        costBasis += consumed * lot.price;
        if (lot.quantity - consumed > 1e-10) nextLots.push({ ...lot, quantity: lot.quantity - consumed });
    }
    const proceeds = unknownPrice ? null : qty * unitPrice - charge;
    position.lots = nextLots;
    position.quantity = Math.max(0, position.quantity - qty);
    if (!nextLots.length) { position.quantity = 0; position.isDeleted = true; position.deletedAt = new Date(); }
    position.$locals.activityEvent = { type: 'SELL', quantity: qty, price: unitPrice, fee: charge, amount: proceeds, costBasis, realizedGain: proceeds === null ? null : proceeds - costBasis, occurredAt, note: String(note).slice(0, 500), broker: position.broker };
    return position.$locals.activityEvent;
}

export function installActivityHooks(schema) {
    schema.post('init', doc => { doc.$locals.originalHolding = holdingSnapshot(doc); });
    schema.pre('save', function () {
        const original = this.$locals.originalHolding;
        const current = holdingSnapshot(this);
        const changed = this.isNew || JSON.stringify(original) !== JSON.stringify(current);
        const explicit = this.$locals.activityEvent;
        if (!changed && !explicit) return;
        if (!this.isNew && !this.activity.length && original) this.activity.push(...legacyEvents({ ...original, createdAt: this.createdAt }));
        let event = explicit;
        if (!event) {
            let type = 'ADJUSTMENT';
            if (this.isNew) type = 'BUY';
            else if (!original.isDeleted && current.isDeleted) type = 'REMOVE';
            else if (original.isDeleted && !current.isDeleted) type = 'RESTORE';
            else if (current.quantity > original.quantity && current.lots.length === original.lots.length + 1 && JSON.stringify(current.lots.slice(0, -1)) === JSON.stringify(original.lots)) type = 'BUY';
            const lot = current.lots.at(-1);
            event = { type, quantity: type === 'BUY' ? (this.isNew ? current.quantity : current.quantity - original.quantity) : null,
                price: type === 'BUY' ? (this.isNew ? current.averagePrice : lot.price) : null,
                occurredAt: type === 'BUY' ? (lot?.date || new Date()) : new Date(),
                note: type === 'ADJUSTMENT' ? 'Holding correction; not a priced trade' : (type === 'REMOVE' ? 'Removed from tracking; not a priced sale' : ''),
            };
        }
        if (event.type === 'BUY' && event.amount == null) event.amount = event.quantity * event.price;
        // Regular trades keep compact snapshots: purchase events already retain
        // their own execution data. Keep full lot snapshots for corrections.
        const compact = snapshot => snapshot ? { quantity: snapshot.quantity, averagePrice: snapshot.averagePrice, broker: snapshot.broker, isDeleted: snapshot.isDeleted } : null;
        this.activity.push({ ...event, before: event.type === 'ADJUSTMENT' ? original : compact(original), after: event.type === 'ADJUSTMENT' ? current : compact(current), broker: event.broker || current.broker });
    });
    schema.post('save', doc => { doc.$locals.originalHolding = holdingSnapshot(doc); delete doc.$locals.activityEvent; });
}
