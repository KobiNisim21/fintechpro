export interface ChartColor { fill: string; text: string }

const holdingPalette = [
    '#5D41EC', '#5A8FB5', '#4D9B8C', '#A47DAB', '#D0A15B', '#7685B5',
    '#A97384', '#7E9B72', '#638FA0', '#A18E76', '#8F7CB3', '#7B9297',
    '#B98769', '#7899AD', '#9A8FAD', '#879E9B',
];
const sectorNames = ['Technology', 'Financials', 'Communication Services', 'Health Care', 'Consumer Discretionary', 'Industrials', 'Consumer Staples', 'Energy', 'Utilities', 'Real Estate', 'Materials', 'Unknown'];
const sectorPalette = ['#ECE9FA', '#E6EFF9', '#E3F2EE', '#F5EAF1', '#FBF0DF', '#E8EDF5', '#EDF3E5', '#F8EAE3', '#E4F1F5', '#EEEBF5', '#F1EEE4', '#F0F2F5'];

function hashName(name: string) {
    let hash = 2166136261;
    for (const char of name.toUpperCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    // Avalanche similar ticker names so generated hues do not cluster together.
    hash = Math.imul(hash ^ hash >>> 16, 0x85ebca6b);
    hash = Math.imul(hash ^ hash >>> 13, 0xc2b2ae35);
    return (hash ^ hash >>> 16) >>> 0;
}

function luminance(hex: string) {
    const channels = [1, 3, 5].map(offset => {
        const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

export function colorContrast(a: string, b: string) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

function readableText(fill: string) {
    const ink = '#0A101F', white = '#FFFFFF';
    if (colorContrast(fill, white) >= 4.5 && colorContrast(fill, white) >= colorContrast(fill, ink)) return white;
    return colorContrast(fill, ink) >= 4.5 ? ink : '#000000';
}

function hslHex(hue: number, saturation: number, lightness: number) {
    const s = saturation / 100, l = lightness / 100;
    const a = s * Math.min(l, 1 - l);
    const channel = (n: number) => {
        const k = (n + hue / 30) % 12;
        return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

/** Identity-based, order-independent colors; collisions receive generated colors. */
export function buildHoldingColors(names: readonly string[]) {
    const result = new Map<string, ChartColor>(), used = new Set<string>();
    for (const name of [...new Set(names)].sort()) {
        const hash = hashName(name);
        let fill = holdingPalette[hash % holdingPalette.length], attempt = 0;
        while (used.has(fill)) {
            fill = hslHex((hash % 36000 / 100 + attempt * 137.508) % 360, 42 + (hash >>> 8) % 16, 48 + (hash >>> 16) % 12);
            attempt++;
        }
        used.add(fill);
        result.set(name, { fill, text: readableText(fill) });
    }
    return result;
}

export function sectorColors(name: string, _index = 0): [string, string] {
    const known = sectorNames.indexOf(name);
    return [sectorPalette[known < 0 ? hashName(name) % (sectorPalette.length - 1) : known], '#334155'];
}

export const groupedHoldingColor: ChartColor = { fill: '#E2E8F0', text: '#334155' };
