import fs from 'fs'
import path from 'path'

const DEFAULT_STATE = Object.freeze({ lockdown: false, updatedAt: null })
const MAX_AUDIT_BYTES = 256 * 1024

export function createSecurityStore(statePath = path.join(process.cwd(), 'data', 'panther-security.json')) {
  const auditPath = path.join(path.dirname(statePath), 'panther-security.log')

  function ensureDirectory() {
    fs.mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 })
    try { fs.chmodSync(path.dirname(statePath), 0o700) } catch {}
  }

  function getState() {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      return { ...DEFAULT_STATE, lockdown: Boolean(state.lockdown), updatedAt: state.updatedAt || null, corrupt: false }
    } catch (error) {
      if (error.code === 'ENOENT') return { ...DEFAULT_STATE, corrupt: false }
      // Fail closed if state exists but cannot be trusted or read.
      return { lockdown: true, updatedAt: null, corrupt: true }
    }
  }

  function setLockdown(enabled) {
    ensureDirectory()
    const state = { lockdown: Boolean(enabled), updatedAt: new Date().toISOString() }
    const tempPath = `${statePath}.${process.pid}.tmp`
    fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tempPath, statePath)
    try { fs.chmodSync(statePath, 0o600) } catch {}
    return { ...state, corrupt: false }
  }

  function audit(event, command = '') {
    ensureDirectory()
    try {
      if (fs.existsSync(auditPath) && fs.statSync(auditPath).size >= MAX_AUDIT_BYTES) {
        const previous = `${auditPath}.1`
        try { fs.rmSync(previous, { force: true }) } catch {}
        fs.renameSync(auditPath, previous)
      }
      const entry = {
        at: new Date().toISOString(),
        event: String(event).replace(/[^a-z0-9_-]/gi, '').slice(0, 40),
        command: String(command).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || null
      }
      fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 })
      try { fs.chmodSync(auditPath, 0o600) } catch {}
    } catch (error) {
      console.error('[SECURITY] Could not write audit event:', error.message)
    }
  }

  return { getState, setLockdown, audit }
}

export const securityStore = createSecurityStore()
