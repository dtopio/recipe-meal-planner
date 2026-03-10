/** Date/time formatting utilities */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getDate()}`
}

export function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return DAY_NAMES[d.getDay()]
}

export function getDayNameShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return DAY_NAMES_SHORT[d.getDay()]
}

export function isToday(dateStr: string): boolean {
  // Using mock "today" for demo
  return dateStr === '2026-03-11'
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatTimeAgo(dateStr: string): string {
  const now = new Date('2026-03-11T12:00:00Z')
  const d = new Date(dateStr)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export { DAY_NAMES, DAY_NAMES_SHORT, MONTH_NAMES, MONTH_NAMES_SHORT }
