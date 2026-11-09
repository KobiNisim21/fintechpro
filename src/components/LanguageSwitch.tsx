import { Languages } from 'lucide-react';
import { setLanguage, useLanguage } from '@/i18n';

export function LanguageSwitch() {
  const language = useLanguage();
  return <button type="button" className="language-switch" onClick={() => setLanguage(language === 'en' ? 'he' : 'en')}
    aria-label={language === 'en' ? 'Switch site language to Hebrew' : 'החלפת שפת האתר לאנגלית'}
    title={language === 'en' ? 'Switch site language to Hebrew' : 'החלפת שפת האתר לאנגלית'}>
    <Languages size={18} aria-hidden="true" />
    <span lang={language === 'en' ? 'he' : 'en'} dir={language === 'en' ? 'rtl' : 'ltr'}>{language === 'en' ? 'עברית' : 'English'}</span>
  </button>;
}
