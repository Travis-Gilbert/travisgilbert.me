import { Extension, InputRule } from '@tiptap/core';

const REPLACEMENTS: Array<[RegExp, string]> = [
  // Visual direction shorthand
  [/\{v:\s?([^}]+)\}$/, '{VISUAL: $1}'],
  // Needs source flag
  [/\[ns\]$/i, '[NEEDS SOURCE]'],
  // Question flag
  [/\[q:\s?([^\]]+)\]$/, '[QUESTION: $1]'],
  // Common symbols
  [/\(deg\)$/, '\u00B0'],
  [/\(approx\)$/, '\u2248'],
  [/\(therefore\)$/, '\u2234'],
  [/\(because\)$/, '\u2235'],
];

const CustomInputRules = Extension.create({
  name: 'customInputRules',

  addInputRules() {
    return REPLACEMENTS.map(
      ([pattern, replacement]) =>
        new InputRule({
          find: pattern,
          handler: ({ state, range, match }) => {
            const { tr } = state;
            let text = replacement;

            if (match[1]) {
              text = replacement.replace('$1', match[1]);
            }

            tr.replaceWith(range.from, range.to, state.schema.text(text));
          },
        }),
    );
  },
});

export default CustomInputRules;
