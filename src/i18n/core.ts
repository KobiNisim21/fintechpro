import messages from './messages.json';

export type Language = 'en' | 'he';
const catalog: Record<string, { en: string; he: string }> = messages;
const hasMessage = (key: string) => Object.prototype.hasOwnProperty.call(catalog, key);
export const languageLocale = (language: Language) => language === 'he' ? 'he-IL' : 'en-US';

/** Only interface messages are translated; never translate symbols or user data. */
export function translate(language: Language, message: string, values: readonly unknown[] = []): string {
  const key = message.replace(/\s+/g, ' ').trim();
  const entry = hasMessage(key) ? catalog[key] : undefined;
  if (!entry) return message;
  const leading = /^\s/.test(message) ? ' ' : '';
  const trailing = /\s$/.test(message) ? ' ' : '';
  return leading + entry[language].replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    if (Number(index) >= values.length) return placeholder;
    const value = String(values[Number(index)] ?? '');
    // Isolate numbers, tickers and names from surrounding RTL punctuation.
    return language === 'he' ? `\u2068${value}\u2069` : value;
  }) + trailing;
}

/** Provider-generated labels have a small, known vocabulary, unlike news prose. */
export function translateReference(language: Language, message: string): string {
  if (hasMessage(message)) return translate(language, message);
  const event = /^(Non-Farm Payrolls|CPI|PPI|Israel CPI|GDP|FOMC Meeting Minutes) \(([^)]+)\)$/.exec(message);
  if (event) return `${translate(language, event[1])} (${translate(language, event[2])})`;
  const proxy = /^(.*) \(benchmark proxy for ([A-Z]+)\)$/.exec(message);
  if (proxy) return `${translate(language, proxy[1])} (${translate(language, 'benchmark proxy for')} ${proxy[2]})`;
  const observed = /^(.*) \(observed\)$/i.exec(message);
  if (observed) return `${translate(language, observed[1])} (${translate(language, 'observed')})`;
  const unresolved = /^(\S+) unresolved$/.exec(message);
  if (unresolved) return `${unresolved[1]} — ${translate(language, 'unresolved')}`;
  return message;
}

export function translateLiveAlert(language: Language, alert: { type: string; message: string }): string {
  if (alert.type === 'news' || language === 'en') return alert.message;
  const daily = /^(.*) (up|down) ([\d.]+)% today$/.exec(alert.message);
  if (daily) return translate(language, `{0} ${daily[2]} {1}% today`, [daily[1], daily[3]]);
  const low = /^(.*) is near its 52-week low \(\$([\d.]+)\)$/.exec(alert.message);
  if (low) return translate(language, '{0} is near its 52-week low (${1})', [low[1], low[2]]);
  const earnings = /^(.*) reports earnings on (.+)$/.exec(alert.message);
  if (earnings) return translate(language, '{0} reports earnings on {1}', [earnings[1], earnings[2]]);
  return alert.message;
}
