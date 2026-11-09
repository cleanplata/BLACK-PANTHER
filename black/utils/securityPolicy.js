export function isOwnerOnlyDenied(command, isOwner) {
  return Boolean(command?.ownerOnly) && !Boolean(isOwner)
}

export function createCommandRateLimiter({ limit = 8, windowMs = 10_000, now = () => Date.now() } = {}) {
  const activity = new Map()

  return {
    allow(senderKey) {
      const key = String(senderKey || 'unknown')
      const time = now()
      const cutoff = time - windowMs
      const recent = (activity.get(key) || []).filter(timestamp => timestamp > cutoff)
      if (recent.length >= limit) {
        activity.set(key, recent)
        return false
      }
      recent.push(time)
      activity.set(key, recent)

      // Bound memory if the bot receives traffic from many one-off senders.
      if (activity.size > 2_000) {
        for (const [sender, timestamps] of activity) {
          const active = timestamps.filter(timestamp => timestamp > cutoff)
          if (active.length) activity.set(sender, active)
          else activity.delete(sender)
        }
      }
      return true
    },
    clear() { activity.clear() }
  }
}
