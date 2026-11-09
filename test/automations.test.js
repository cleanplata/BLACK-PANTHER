import test from 'node:test'
import assert from 'node:assert/strict'
import { maybeAutoReact, parseReactions, shouldAutoReact } from '../black/automations.js'

test('auto-reaction is disabled unless explicitly enabled', async () => {
  let calls = 0
  const sock = { async sendMessage() { calls++ } }
  const msg = { key: { remoteJid: '123@s.whatsapp.net', id: 'm1' }, message: { conversation: 'hello' } }
  assert.equal(await maybeAutoReact(sock, msg, { AUTO_REACT: false }), false)
  assert.equal(calls, 0)
})

test('auto-reaction respects group and DM modes and ignores self/status messages', () => {
  const base = { enabled: true, message: { conversation: 'hello' } }
  assert.equal(shouldAutoReact({ ...base, mode: 'groups', from: '123@s.whatsapp.net' }), false)
  assert.equal(shouldAutoReact({ ...base, mode: 'dm', from: '123@g.us' }), false)
  assert.equal(shouldAutoReact({ ...base, from: '123@g.us', fromMe: true }), false)
  assert.equal(shouldAutoReact({ ...base, from: 'status@broadcast' }), false)
  assert.equal(shouldAutoReact({ ...base, mode: 'groups', from: '123@g.us' }), true)
})

test('enabled auto-reaction sends only a configured emoji on the original message key', async () => {
  const calls = []
  const sock = { async sendMessage(...args) { calls.push(args) } }
  const msg = { key: { remoteJid: '123@g.us', id: 'm2' }, message: { conversation: 'hello' } }
  const result = await maybeAutoReact(sock, msg, {
    AUTO_REACT: true,
    AUTO_REACT_MODE: 'groups',
    AUTO_REACT_EMOJIS: '🐾,⚡'
  }, () => 0.99)
  assert.equal(result, true)
  assert.deepEqual(calls, [['123@g.us', { react: { text: '⚡', key: msg.key } }]])
})

test('empty emoji configuration uses safe defaults', () => {
  assert.deepEqual(parseReactions(' , '), ['🐾', '⚡', '💜'])
})
