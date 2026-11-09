import { useSyncExternalStore } from 'react';
import { translate, translateReference, translateLiveAlert, languageLocale, type Language } from './core';
export type { Language } from './core';

const STORAGE_KEY = 'fintechpro.language.v1';
function savedLanguage(): Language {
  try { return localStorage.getItem(STORAGE_KEY) === 'he' ? 'he' : 'en'; }
  catch { return 'en'; }
}
let language = savedLanguage();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => language;
function applyDocumentLanguage() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  document.title = language === 'he' ? 'FinTechPro — תיק ההשקעות שלי' : 'FinTechPro — My Portfolio';
}
applyDocumentLanguage();

export function setLanguage(next: Language) {
  if (language === next) return;
  language = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Session choice still works. */ }
  applyDocumentLanguage();
  listeners.forEach(listener => listener());
}
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) setLanguage(savedLanguage());
});
export const useLanguage = () => useSyncExternalStore(subscribe, snapshot, () => 'en' as Language);
export const locale = () => languageLocale(language);
export const t = (message: string, values?: readonly unknown[]) => translate(language, message, values);
export const referenceText = (message: string) => translateReference(language, message);
export const liveAlertText = (alert: { type: string; message: string }) => translateLiveAlert(language, alert);
export function relativeTime(isoDate: string) {
  const milliseconds = new Date(isoDate).getTime() - Date.now();
  if (!Number.isFinite(milliseconds)) return t('recently');
  const minutes = Math.round(milliseconds / 60_000);
  const formatter = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  return Math.abs(minutes) < 60 ? formatter.format(minutes, 'minute')
    : Math.abs(minutes) < 1440 ? formatter.format(Math.round(minutes / 60), 'hour')
    : formatter.format(Math.round(minutes / 1440), 'day');
}
export const errorText = (message: string) => {
  const translated = t(message);
  return translated !== message || language === 'en' || /[\u0590-\u05ff]/.test(message) ? translated : t('Action failed. Please retry.');
};
