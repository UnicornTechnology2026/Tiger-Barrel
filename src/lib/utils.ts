import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(
  date: string | Date,
  format: 'short' | 'long' | 'time' | 'datetime' = 'short'
) {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  switch (format) {
    case 'time':
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    case 'datetime':
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    case 'long':
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    default:
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/** Haversine distance in meters */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function checkGeofence(
  agentLat: number,
  agentLon: number,
  outletLat: number,
  outletLon: number,
  radiusMeters: number
): { isWithin: boolean; distanceMeters: number; requiredRadius: number } {
  const distance = haversineDistance(agentLat, agentLon, outletLat, outletLon)
  return {
    isWithin: distance <= radiusMeters,
    distanceMeters: Math.round(distance),
    requiredRadius: radiusMeters,
  }
}

export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function isValidLat(lat: number): boolean {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90
}

export function isValidLng(lng: number): boolean {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180
}

export function statusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'completed':
      return 'bg-emerald-100 text-emerald-800'
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800'
    case 'inactive':
    case 'cancelled':
    case 'suspended':
      return 'bg-slate-100 text-slate-600'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}
