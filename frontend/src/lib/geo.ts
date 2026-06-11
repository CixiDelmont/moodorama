export interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * Promise wrapper around the browser geolocation API with friendly errors.
 */
export function getCurrentLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => {
        const messages: Record<number, string> = {
          1: 'Location permission denied. Enable it to place your mood on the map.',
          2: 'Your location is currently unavailable. Please try again.',
          3: 'Timed out while finding your location. Please try again.',
        };
        reject(new Error(messages[err.code] ?? err.message));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}
