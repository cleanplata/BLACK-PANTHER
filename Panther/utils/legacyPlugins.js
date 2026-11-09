import { createRequire } from 'node:module'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import CONFIG from '../../black/config.js'

const require = createRequire(import.meta.url)
const legacyConfig = require('../../guru/config/settings.js')
const legacyLoader = require('../../guru/handlers/loader.js')

const OWNER_ONLY_NAMES = new Set([
  'allvar', 'getvar', 'setvar', 'triggerupdate', 'update', 'broadcast', 'broadcaststatus',
  'robotbroadcast', 'massdm', 'masspromote', 'massdemote', 'nuke', 'xkill', 'mentionbomb',
  'shell', 'eval', 'eval2', 'restart', 'restartbot', 'shutdown', 'kill', 'cleartmp',
  'clearcache', 'getcmd', 'getfunc', 'joingc', 'leavegc', 'groupclone', 'tokengen',
  'lockdown', 'unlockdown', 'setbotpic', 'setmenupic', 'setbotname', 'setmenu',
  'setfooter', 'setcaption', 'botidentity', 'rebrand', 'tobugil', 'undress', 'morph',
  'hentai', 'xvideos', 'ass', 'boobs', 'fuck'
])

const ADMIN_ONLY_NAMES = new Set([
  'add', 'approve-all', 'reject-all', 'requests', 'remove', 'kick', 'promote', 'demote',
  'promoteall', 'demoteall', 'close', 'open', 'link', 'revoke', 'clear', 'clearchat',
  'tagall', 'tagadmins', 'foreigners', 'warn', 'resetwarn', 'setwarncount', 'setwarnlimit',
  'welcome', 'goodbye', 'antibot', 'antilink', 'antistatusmention', 'antitag', 'antiforeign',
  'mute', 'unmute', 'pin', 'pinm', 'togstatus', 'accept', 'reject', 'acceptall', 'rejectall'
])

function textFromMessage(message = {}) {
  return message.conversation || message.extendedTextMessage?.text ||
    message.imageMessage?.caption || message.videoMessage?.caption ||
    message.documentMessage?.caption || message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId || ''
}

function typeFromMessage(message = {}) {
  return Object.keys(message)[0] || 'unknown'
}

function normalizeNumber(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '')
}

function makeMessageView({ raw, sock, from, sender, senderNumber, isOwner, groupMeta, isAdmin, isBotAdmin }) {
  const message = raw?.message || {}
  const contextInfo = message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo || message.videoMessage?.contextInfo ||
    message.audioMessage?.contextInfo || message.documentMessage?.contextInfo ||
    message.stickerMessage?.contextInfo || {}
  const quotedContent = contextInfo.quotedMessage || null
  const quotedKey = contextInfo.stanzaId ? {
    remoteJid: from,
    id: contextInfo.stanzaId,
    participant: contextInfo.participant,
    fromMe: false
  } : null

  const quoted = quotedContent ? {
    key: quotedKey,
    message: quotedContent,
    sender: contextInfo.participant || contextInfo.remoteJid || '',
    chat: from,
    mtype: typeFromMessage(quotedContent),
    text: textFromMessage(quotedContent),
    body: textFromMessage(quotedContent),
    mimetype: Object.values(quotedContent)[0]?.mimetype || '',
    get msg() { return Object.values(quotedContent)[0] || null },
    async download() {
      if (!quotedKey) throw new Error('Quoted media key is unavailable.')
      const full = { key: quotedKey, message: quotedContent }
      return downloadMediaMessage(full, 'buffer', {})
    }
  } : null

  const view = {
    ...raw,
    key: raw?.key || {},
    message,
    chat: from,
    from,
    sender: sender || '',
    senderNumber: senderNumber || normalizeNumber(sender),
    pushName: raw?.pushName || 'WhatsApp user',
    body: textFromMessage(message),
    text: textFromMessage(message),
    mtype: typeFromMessage(message),
    isGroup: from.endsWith('@g.us'),
    isOwner: Boolean(isOwner),
    fromMe: Boolean(raw?.key?.fromMe),
    isAdmin: Boolean(isAdmin),
    isBotAdmin: Boolean(isBotAdmin),
    isSuperAdmin: Boolean(isAdmin),
    isSudo: Boolean(isOwner),
    isButtonResponse: false,
    reactKey: raw?.key,
    mentionedJid: contextInfo.mentionedJid || [],
    tagged: contextInfo.mentionedJid || [],
    participants: groupMeta?.participants || [],
    groupMetadata: groupMeta || null,
    quoted,
    quotedMsg: quotedContent,
    quotedKey,
    quotedUser: quoted?.sender || '',
    async download() {
      return downloadMediaMessage(raw, 'buffer', {})
    },
    async reply(content, options = {}) {
      const payload = typeof content === 'string' ? { text: content } : content
      return sock.sendMessage(from, payload, { quoted: raw, ...options })
    }
  }
  view.react = async (emoji) => sock.sendMessage(from, { react: { text: emoji, key: raw.key } })
  view.delete = async () => sock.sendMessage(from, { delete: raw.key })
  return view
}

async function resolveGroupContext(sock, from, sender, senderNumber) {
  if (!String(from || '').endsWith('@g.us')) return { groupMeta: null, isAdmin: false, isBotAdmin: false }
  try {
    const groupMeta = await sock.groupMetadata(from)
    const participants = groupMeta?.participants || []
    const senderDigits = normalizeNumber(senderNumber || sender)
    const senderPart = participants.find(p => {
      const identities = [p.id, p.jid, p.pn, p.phoneNumber].filter(Boolean)
      return identities.some(id => id === sender || normalizeNumber(id) === senderDigits)
    })
    const botDigits = normalizeNumber(sock.user?.id)
    const botPart = participants.find(p => [p.id, p.jid, p.pn, p.phoneNumber].filter(Boolean).some(id => normalizeNumber(id) === botDigits))
    const admin = p => p?.admin === 'admin' || p?.admin === 'superadmin'
    return { groupMeta, isAdmin: admin(senderPart), isBotAdmin: admin(botPart) }
  } catch {
    return { groupMeta: null, isAdmin: false, isBotAdmin: false }
  }
}

export async function loadLegacyCommands() {
  legacyConfig.BOT_NAME = CONFIG.BOT_NAME || 'Black Panther'
  process.env.BOT_NAME = legacyConfig.BOT_NAME
  legacyConfig.PACK_NAME = legacyConfig.BOT_NAME
  legacyConfig.BOT_PIC = CONFIG.BOT_PIC
  if (CONFIG.BOT_PIC) process.env.BOT_PIC = CONFIG.BOT_PIC
  legacyConfig.OWNER_NUMBER = CONFIG.OWNER_NUMBER || process.env.OWNER_NUMBER || ''
  legacyConfig.OWNER_NAME = CONFIG.OWNER_NAME || 'Black Panther Owner'
  legacyConfig.MODE = CONFIG.MODE
  legacyConfig.BOT_PREFIX = CONFIG.PREFIXES?.[0] || '.'
  await legacyLoader.loadPlugins()

  const commands = legacyLoader.getAllCmds()
  return commands.map(legacy => {
    const name = String(legacy.name || '').toLowerCase()
    const aliases = (legacy.aliases || []).map(alias => String(alias).toLowerCase()).filter(Boolean)
    const category = String(legacy.category || 'Legacy').replace(/^./, c => c.toUpperCase())
    const hardOwnerOnly = OWNER_ONLY_NAMES.has(name) || ['owner', 'heroku', 'settings'].includes(legacy.category)
    const adminOnly = !hardOwnerOnly && (legacy.adminOnly || ADMIN_ONLY_NAMES.has(name))
    return {
      name,
      aliases,
      description: legacy.desc || `Legacy ${category} feature from the running Black Panther bot.`,
      category: `Legacy ${category}`,
      ownerOnly: Boolean(legacy.ownerOnly || hardOwnerOnly),
      groupOnly: Boolean(legacy.groupOnly),
      adminOnly: Boolean(adminOnly),
      execute: async current => {
        legacyConfig.MODE = current.config.MODE
        const resolved = current.groupMeta
          ? {
              groupMeta: current.groupMeta,
              isAdmin: Boolean(current.isGroupAdmin),
              isBotAdmin: Boolean(current.isBotGroupAdmin)
            }
          : await resolveGroupContext(current.sock, current.from, current.sender, current.senderNumber)
        const { groupMeta, isAdmin, isBotAdmin } = resolved
        const m = makeMessageView({
          raw: current.msg,
          sock: current.sock,
          from: current.from,
          sender: current.sender,
          senderNumber: current.senderNumber,
          isOwner: current.isOwner,
          groupMeta,
          isAdmin,
          isBotAdmin
        })
        if (legacy.groupOnly && !m.isGroup) {
          await m.reply('This command can only be used in a group.')
          return
        }
        if (adminOnly && !isAdmin) {
          await m.reply('Only a group admin can run this command.')
          return
        }
        const context = {
          sock: current.sock,
          client: current.sock,
          from: current.from,
          sender: current.sender,
          senderNumber: current.senderNumber,
          pushName: m.pushName,
          msg: current.msg,
          m,
          text: current.text,
          body: m.body,
          args: current.args,
          command: name,
          groupMeta,
          isGroup: m.isGroup,
          isAdmin,
          isBotAdmin,
          isOwner: current.isOwner,
          quoted: m.quoted,
          reply: m.reply,
          send: (payload, options) => current.sock.sendMessage(current.from, payload, options),
          react: m.react,
          config: legacyConfig
        }
        return legacy.handler(context)
      }
    }
  })
}

export function isLegacyOwnerOnly(name) {
  return OWNER_ONLY_NAMES.has(String(name || '').toLowerCase())
}

export function isLegacyAdminOnly(name) {
  return ADMIN_ONLY_NAMES.has(String(name || '').toLowerCase())
}
