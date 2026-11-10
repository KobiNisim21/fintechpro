export interface AllocationValue { name: string; value: number }
export const ALLOCATION_BUBBLE_LIMIT = 16;
export interface AllocationBubble extends AllocationValue {
    percent: number;
    otherCount: number;
    x: number;
    y: number;
    r: number;
}

/** Presentation only: circle AREA is proportional to value, with no minimum size. */
export function buildAllocationBubbles(data: readonly AllocationValue[]) {
    const combined = new Map<string, number>();
    for (const row of data) {
        if (Number.isFinite(row.value) && row.value > 0) combined.set(row.name, (combined.get(row.name) || 0) + row.value);
    }
    const values = [...combined].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const total = values.reduce((sum, row) => sum + row.value, 0);
    if (!Number.isFinite(total) || total <= 0) return { rows: [], bubbles: [], viewBox: '0 0 120 120' };
    const rows = values.map(row => ({ ...row, percent: row.value / total * 100 }));
    // Keep the graphic legible at any portfolio size; the legend retains EVERY holding.
    const visible = rows.length > ALLOCATION_BUBBLE_LIMIT
        ? [...rows.slice(0, ALLOCATION_BUBBLE_LIMIT - 1).map(row => ({ ...row, otherCount: 0 })), {
            name: '', value: rows.slice(ALLOCATION_BUBBLE_LIMIT - 1).reduce((sum, row) => sum + row.value, 0),
            percent: rows.slice(ALLOCATION_BUBBLE_LIMIT - 1).reduce((sum, row) => sum + row.percent, 0), otherCount: rows.length - ALLOCATION_BUBBLE_LIMIT + 1,
        }]
        : rows.map(row => ({ ...row, otherCount: 0 }));
    const largest = Math.max(...visible.map(row => row.value));
    const bubbles: AllocationBubble[] = [];
    const gap = 2;
    for (const row of [...visible].sort((a, b) => b.value - a.value)) {
        const r = 52 * Math.sqrt(row.value / largest);
        const circle = { ...row, r, x: 0, y: 0 };
        if (bubbles.length === 1) circle.x = -(bubbles[0].r + r + gap);
        if (bubbles.length > 1) {
            let best: { x: number; y: number; score: number } | undefined;
            for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {
                const a = bubbles[i], b = bubbles[j];
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
                const ra = a.r + r + gap, rb = b.r + r + gap;
                const along = (d * d + ra * ra - rb * rb) / (2 * d);
                const heightSquared = ra * ra - along * along;
                if (heightSquared < -1e-8) continue;
                const height = Math.sqrt(Math.max(0, heightSquared));
                for (const side of [-1, 1]) {
                    const x = a.x + along * dx / d + side * height * dy / d;
                    const y = a.y + along * dy / d - side * height * dx / d;
                    if (bubbles.some(other => Math.hypot(x - other.x, y - other.y) < r + other.r + gap - 1e-7)) continue;
                    const left = Math.min(x - r, ...bubbles.map(c => c.x - c.r));
                    const right = Math.max(x + r, ...bubbles.map(c => c.x + c.r));
                    const top = Math.min(y - r, ...bubbles.map(c => c.y - c.r));
                    const bottom = Math.max(y + r, ...bubbles.map(c => c.y + c.r));
                    const score = (right - left) * (bottom - top) + y * .001;
                    if (!best || score < best.score) best = { x, y, score };
                }
            }
            // Guaranteed non-overlapping fallback, even with extreme value ratios.
            circle.x = best?.x ?? Math.max(...bubbles.map(c => c.x + c.r)) + r + gap;
            circle.y = best?.y ?? 0;
        }
        bubbles.push(circle);
    }
    const left = Math.min(...bubbles.map(c => c.x - c.r)) - 6;
    const top = Math.min(...bubbles.map(c => c.y - c.r)) - 6;
    const right = Math.max(...bubbles.map(c => c.x + c.r)) + 6;
    const bottom = Math.max(...bubbles.map(c => c.y + c.r)) + 6;
    return { rows, bubbles, viewBox: `${left} ${top} ${right - left} ${bottom - top}` };
}
