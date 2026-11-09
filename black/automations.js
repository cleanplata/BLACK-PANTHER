const DEFAULT_REACTIONS = ['🐾', '⚡', '💜']

function normalizeMode(mode) {
  const value = String(mode || 'all').trim().toLowerCase()
  return ['all', 'groups', 'dm'].includes(value) ? value : 'all'
}

function shouldAutoReact({ enabled, mode = 'all', from, fromMe = false, message }) {
  if (!enabled || fromMe || !message || !from || from === 'status@broadcast') return false
  const isGroup = from.endsWith('@g.us')
  const selectedMode = normalizeMode(mode)
  if (selectedMode === 'groups' && !isGroup) return false
  if (selectedMode === 'dm' && isGroup) return false
  return true
}

function parseReactions(value) {
  const reactions = String(value || '').split(',').map(item => item.trim()).filter(Boolean)
  return reactions.length ? reactions : DEFAULT_REACTIONS
}

async function maybeAutoReact(sock, msg, config, random = Math.random) {
  const from = msg?.key?.remoteJid
  if (!shouldAutoReact({
    enabled: config?.AUTO_REACT,
    mode: config?.AUTO_REACT_MODE,
    from,
    fromMe: Boolean(msg?.key?.fromMe),
    message: msg?.message
  })) return false

  const reactions = parseReactions(config?.AUTO_REACT_EMOJIS)
  const selected = reactions[Math.min(reactions.length - 1, Math.floor(random() * reactions.length))]
  await sock.sendMessage(from, { react: { text: selected, key: msg.key } })
  return true
}

export { DEFAULT_REACTIONS, shouldAutoReact, parseReactions, maybeAutoReact }
