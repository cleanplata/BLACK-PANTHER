const inline = value => String(value ?? '—').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

export function pantherHeader(botName, section) {
  return `> ╭──〔 𖤍 ${inline(botName)} // ${inline(section).toUpperCase()} 〕──◈`;
}

export function pantherRow(label, value, marker = '◈') {
  return `> ┃ ${marker} *${inline(label)}*  ›  ${inline(value)}`;
}

export function pantherDivider(label = '') {
  return label
    ? `> ┠─〔 ${inline(label).toUpperCase()} 〕────────────────`
    : '> ┠────────────────────────';
}

export function pantherFooter(label) {
  return `> ╰──〔 ${inline(label)} 〕──◈`;
}
