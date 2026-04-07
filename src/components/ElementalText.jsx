import React from 'react';

const WORD_STYLE = {
  physical: 'elem-word elem-word--physical',
  blaze: 'elem-word elem-word--blaze',
  thunder: 'elem-word elem-word--thunder',
  frost: 'elem-word elem-word--frost',
  holy: 'elem-word elem-word--holy',
  unholy: 'elem-word elem-word--unholy',
};

const TOKEN_RULES = [
  { regex: /\bphysical\b/gi, className: WORD_STYLE.physical },
  { regex: /\bblaze\b/gi, className: WORD_STYLE.blaze },
  { regex: /\bthunder\b/gi, className: WORD_STYLE.thunder },
  { regex: /\bfrost\b/gi, className: WORD_STYLE.frost },
  { regex: /\bholy\b/gi, className: WORD_STYLE.holy },
  { regex: /\bunholy\b/gi, className: WORD_STYLE.unholy },
  // Legacy aliases still present in some descriptions.
  { regex: /\bfire\b/gi, className: WORD_STYLE.blaze },
  { regex: /\bcold\b/gi, className: WORD_STYLE.frost },
  { regex: /\blightning\b/gi, className: WORD_STYLE.thunder },
  { regex: /\bchaos\b/gi, className: WORD_STYLE.unholy },
];

function splitByRule(chunks, rule) {
  const out = [];
  for (const chunk of chunks) {
    if (typeof chunk !== 'string') {
      out.push(chunk);
      continue;
    }
    let last = 0;
    chunk.replace(rule.regex, (match, offset) => {
      if (offset > last) out.push(chunk.slice(last, offset));
      out.push({ text: match, className: rule.className });
      last = offset + match.length;
      return match;
    });
    if (last < chunk.length) out.push(chunk.slice(last));
  }
  return out;
}

export function highlightElementalText(text) {
  if (!text || typeof text !== 'string') return text;
  let chunks = [text];
  for (const rule of TOKEN_RULES) chunks = splitByRule(chunks, rule);
  return chunks.map((chunk, i) => {
    if (typeof chunk === 'string') return <React.Fragment key={i}>{chunk}</React.Fragment>;
    return <span key={i} className={chunk.className}>{chunk.text}</span>;
  });
}
