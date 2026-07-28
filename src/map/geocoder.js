export async function searchLocation(query, opts = {}) {
	if (!query || query.length < 2) return [];

	const { limit = 15, signal } = opts;

	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
		const response = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
		const data = await response.json();

		return data.map(item => ({
			name: item.display_name,
			lat: parseFloat(item.lat),
			lon: parseFloat(item.lon),
			shortName: item.name || (item.display_name && item.display_name.split(',')[0]) || item.display_name,
			country: item.address ? item.address.country : ''
		}));
	} catch (error) {
		if (error && error.name === 'AbortError') {
			return [];
		}
		console.error("Geocoding error:", error);
		return [];
	}
}

export async function reverseGeocode(lat, lon, opts = {}) {
	const { signal } = opts;

	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
		const response = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
		const data = await response.json();
		const address = data.address || {};

		return {
			name: address.city || address.town || address.village || address.municipality || address.county || address.state || data.name || '',
			country: address.country || '',
			lat: parseFloat(data.lat) || lat,
			lon: parseFloat(data.lon) || lon
		};
	} catch (error) {
		if (error && error.name === 'AbortError') {
			return null;
		}
		console.error("Reverse geocoding error:", error);
		return null;
	}
}

export function getSystemLocation(opts = {}) {
	const { timeout = 10000, maximumAge = 300000 } = opts;

	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation is not supported by this browser.'));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			position => resolve({
				lat: position.coords.latitude,
				lon: position.coords.longitude
			}),
			error => {
				if (error.code === error.PERMISSION_DENIED) {
					reject(new Error('Location permission denied.'));
				} else if (error.code === error.POSITION_UNAVAILABLE) {
					reject(new Error('Location unavailable.'));
				} else if (error.code === error.TIMEOUT) {
					reject(new Error('Location request timed out.'));
				} else {
					reject(new Error('Could not get your location.'));
				}
			},
			{ enableHighAccuracy: false, timeout, maximumAge }
		);
	});
}

export function formatCoords(lat, lon) {
	const latDir = lat >= 0 ? 'N' : 'S';
	const lonDir = lon >= 0 ? 'E' : 'W';

	return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}
