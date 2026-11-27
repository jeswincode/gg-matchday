import { InputError, record, textField } from '../contracts/identity.ts';

export const platformBrand = Object.freeze({ name: 'Ballers' });
export const foundingBrand = Object.freeze({ name: 'GG Matchday', monogram: 'GG' });

export interface CommunityBrand { name: string; monogram: string; accent?: string; motto?: string }

export function parseBrand(value: unknown): CommunityBrand {
  const data = record(value);
  const brand = defaultBrand(data.name);
  const accent = textField(data.accent, 7, 7);
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new InputError('Choose a six-digit colour.');
  return { ...brand, accent, monogram: textField(data.monogram ?? brand.monogram, 1, 12), motto: textField(data.motto ?? '', 0, 120) };
}

export function defaultBrand(value: unknown) {
  const name = textField(value, 1, 100);
  const letters = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const words = name.split(/\s+/u);
  const characters = (word: string) => Array.from(letters.segment(word), item => item.segment);
  const initials = words.length === 1
    ? characters(words[0]).slice(0, 2)
    : words.slice(0, 2).map(word => characters(word)[0]);
  return { name, monogram: initials.join('').toLocaleUpperCase() };
}
