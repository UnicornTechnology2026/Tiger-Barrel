import type { GeoPosition } from '@/types'

export class GeolocationError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.name = 'GeolocationError'
    this.code = code
  }
}

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
}

export function getCurrentPosition(
  options: PositionOptions = DEFAULT_OPTIONS
): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationError('Geolocation is not supported by this browser.', 0))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        })
      },
      (err) => {
        let message = 'Unable to retrieve location.'
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message =
              'Location permission is required to verify this outlet. Please enable location access in your browser settings.'
            break
          case err.POSITION_UNAVAILABLE:
            message =
              'GPS is currently unavailable. Please move to an open area and try again.'
            break
          case err.TIMEOUT:
            message = 'Location request timed out. Please try again.'
            break
        }
        reject(new GeolocationError(message, err.code))
      },
      options
    )
  })
}

export function watchPosition(
  onSuccess: (pos: GeoPosition) => void,
  onError: (err: GeolocationError) => void,
  options: PositionOptions = DEFAULT_OPTIONS
): number | null {
  if (!navigator.geolocation) {
    onError(new GeolocationError('Geolocation is not supported.', 0))
    return null
  }

  return navigator.geolocation.watchPosition(
    (pos) => {
      onSuccess({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      })
    },
    (err) => {
      let message = 'Location tracking error.'
      if (err.code === err.PERMISSION_DENIED) {
        message = 'Location permission denied. Tracking stopped.'
      }
      onError(new GeolocationError(message, err.code))
    },
    options
  )
}

export function clearWatch(watchId: number) {
  if (navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId)
  }
}

/** Minimum acceptable accuracy in meters */
export const MIN_ACCURACY_METERS = 50
