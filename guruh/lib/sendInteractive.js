export async function sendInteractive(client, m, text) {
  const chat = m.chat || m.from || m.key?.remoteJid
  if (!chat || !client) return
  try {
    return await client.sendMessage(chat, { text }, { quoted: m })
  } catch {
    return client.sendMessage(chat, { text }).catch(() => {})
  }
}
