import { describe, expect, it } from 'vitest';
import { LANGUAGES, MESSAGES, detectLanguage, translate } from './translations';

describe('detectLanguage', () => {
  it('picks the first supported language from the browser list', () => {
    expect(detectLanguage(['de-DE', 'sv-FI', 'fi'])).toBe('sv');
    expect(detectLanguage(['fi-FI'])).toBe('fi');
  });

  it('falls back to English', () => {
    expect(detectLanguage(['de', 'ru'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
});

describe('translate', () => {
  it('interpolates variables', () => {
    expect(translate('en', 'away', { distance: '350 m' })).toBe('350 m away');
    expect(translate('fi', 'away', { distance: '350 m' })).toBe('350 m päässä');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(translate('en', 'away')).toBe('{distance} away');
  });
});

describe('messages', () => {
  it('every language uses the same placeholders as English', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const lang of LANGUAGES) {
      for (const [key, text] of Object.entries(MESSAGES.en)) {
        const translated = MESSAGES[lang][key as keyof typeof MESSAGES.en];
        expect(translated, `${lang}.${key}`).toBeTruthy();
        expect(placeholders(translated), `${lang}.${key}`).toEqual(placeholders(text));
      }
    }
  });
});
