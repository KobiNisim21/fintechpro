import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const messages = JSON.parse(readFileSync(new URL('../src/i18n/messages.json', import.meta.url), 'utf8'));
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const coreSource = readFileSync(new URL('../src/i18n/core.ts', import.meta.url), 'utf8').replace("import messages from './messages.json';", `const messages = ${JSON.stringify(messages)};`);
const coreUrl = `data:text/javascript;base64,${Buffer.from(compile(coreSource)).toString('base64')}`;
const { translate, translateReference, translateLiveAlert, languageLocale } = await import(coreUrl);

test('both languages have readable, matching interpolation parameters', () => {
  assert.ok(Object.keys(messages).length > 400);
  for (const [key, value] of Object.entries(messages)) {
    for (const language of ['en', 'he']) {
      assert.ok(value[language]?.trim(), `${key}: missing ${language}`);
      assert.ok(!value[language].includes('??'), `${key}: corrupt encoding`);
    }
    const parameters = text => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
    assert.deepEqual(parameters(value.en), parameters(value.he), key);
  }
});

test('Hebrew interpolation preserves financial identifiers and isolates bidi values', () => {
  assert.equal(translate('en', 'Edit {0} holdings', ['GOOG']), 'Edit GOOG holdings');
  assert.equal(translate('he', 'Edit {0} holdings', ['GOOG']), 'עריכת החזקות \u2068GOOG\u2069');
  assert.equal(translate('he', 'My custom account'), 'My custom account');
  assert.equal(translate('he', 'constructor'), 'constructor');
  assert.equal(translate('he', '__proto__'), '__proto__');
  assert.equal(translate('he', '  Refresh  '), ' רענון ');
  assert.equal(languageLocale('he'), 'he-IL');
  assert.equal(languageLocale('en'), 'en-US');
});

test('known provider labels and generated alerts translate, external news stays verbatim', () => {
  assert.equal(translateReference('he', 'Non-Farm Payrolls (Nov)'), 'דוח התעסוקה בארה״ב (נובמבר)');
  assert.equal(translateReference('he', 'iShares IVV holdings (benchmark proxy for VOO)'), 'החזקות IVV של iShares (אומדן מדד ייחוס עבור VOO)');
  assert.equal(translateReference('en', 'iShares IVV holdings'), 'iShares IVV holdings');
  assert.match(translateLiveAlert('he', { type: 'gain', message: 'Example Inc up 2.3% today' }), /עלתה/);
  const headline = 'Example Inc up 2.3% today';
  assert.equal(translateLiveAlert('he', { type: 'news', message: headline }), headline);
});

test('language changes persist, notify mounted screens and work with blocked storage', async () => {
  const previous = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  const saved = new Map([['fintechpro.language.v1', 'he']]);
  const events = new Map();
  globalThis.document = { documentElement: { lang: '', dir: '' }, title: '' };
  globalThis.window = { addEventListener: (name, handler) => events.set(name, handler) };
  globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  try {
    let source = readFileSync(new URL('../src/i18n/index.ts', import.meta.url), 'utf8');
    source = source.replace("import { useSyncExternalStore } from 'react';", 'const useSyncExternalStore = (subscribe, snapshot) => { globalThis.__languageSubscribe = subscribe; return snapshot(); };');
    source = source.replace("from './core'", `from '${coreUrl}'`);
    const runtime = await import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`);
    assert.equal(document.documentElement.lang, 'he');
    assert.equal(document.documentElement.dir, 'rtl');
    assert.equal(runtime.useLanguage(), 'he');
    let notifications = 0;
    const unsubscribe = globalThis.__languageSubscribe(() => notifications++);
    runtime.setLanguage('en');
    assert.equal(document.documentElement.dir, 'ltr');
    assert.equal(saved.get('fintechpro.language.v1'), 'en');
    assert.equal(notifications, 1);
    saved.set('fintechpro.language.v1', 'he');
    events.get('storage')({ key: 'fintechpro.language.v1' });
    assert.equal(runtime.useLanguage(), 'he');
    localStorage.setItem = () => { throw new Error('blocked storage'); };
    runtime.setLanguage('en');
    assert.equal(runtime.useLanguage(), 'en');
    assert.equal(document.documentElement.lang, 'en');
    unsubscribe();
  } finally {
    Object.assign(globalThis, previous);
    delete globalThis.__languageSubscribe;
  }
});
