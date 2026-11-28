import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

/** Alle regler, der ikke er variabel-blokkene for :root (mørk) eller lyst tema */
function rulesOutsideVariableBlocks(source: string): string {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return noComments.replace(/:root(\[data-theme='light'\])?\s*\{[^}]*\}/g, '');
}

describe('Farver i styles.css (#294)', () => {
  it('ingen hårdkodede farver uden for variabel-blokkene', () => {
    const rest = rulesOutsideVariableBlocks(css);
    const colours = rest.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![\w-])(white|black)(?![\w-])/g) ?? [];
    expect(colours).toEqual([]);
  });

  it('det lyse tema sætter de samme farvevariabler som det mørke', () => {
    const block = (re: RegExp) => new Set([...(css.match(re)?.[0] ?? '').matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
    const dark = block(/:root\s*\{[^}]*\}/);
    const light = block(/:root\[data-theme='light'\]\s*\{[^}]*\}/);
    const colourVars = [...dark].filter((v) => !['--radius', '--tabbar-h', '--staging', '--staging-text'].includes(v));
    expect(colourVars.filter((v) => !light.has(v))).toEqual([]);
  });
});
