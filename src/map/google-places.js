const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let loadPromise = null;
let sessionToken = null;

export function isGoogleAvailable() {
	return Boolean(GOOGLE_API_KEY);
}

function loadGoogleMaps() {
	if (loadPromise) return loadPromise;

	if (!GOOGLE_API_KEY) {
		return Promise.reject(new Error('No Google Maps API key configured.'));
	}

	loadPromise = new Promise((resolve, reject) => {
		const callbackName = '__mapToPosterGoogleMapsReady';

		window[callbackName] = () => {
			try { delete window[callbackName]; } catch (e) { }
			resolve(window.google.maps);
		};

		const script = document.createElement('script');
		script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_API_KEY)}&v=weekly&libraries=places&loading=async&callback=${callbackName}`;
		script.async = true;
		script.onerror = () => {
			loadPromise = null;
			reject(new Error('Could not load Google Maps. Check the API key and its referrer restrictions.'));
		};

		document.head.appendChild(script);
	});

	return loadPromise;
}

// A session groups all keystrokes of one search with the Place Details call that
// ends it, so Google bills the whole thing as a single autocomplete session.
function getSessionToken(AutocompleteSessionToken) {
	if (!sessionToken) sessionToken = new AutocompleteSessionToken();
	return sessionToken;
}

export async function searchLocationGoogle(query, opts = {}) {
	if (!query || query.length < 2) return [];

	const { limit = 15 } = opts;

	await loadGoogleMaps();
	const { AutocompleteSuggestion, AutocompleteSessionToken } = await window.google.maps.importLibrary('places');

	const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
		input: query,
		sessionToken: getSessionToken(AutocompleteSessionToken)
	});

	return (suggestions || [])
		.map(suggestion => suggestion.placePrediction)
		.filter(Boolean)
		.slice(0, limit)
		.map(prediction => ({
			name: prediction.text ? prediction.text.toString() : '',
			shortName: prediction.mainText ? prediction.mainText.toString() : (prediction.text ? prediction.text.toString() : ''),
			country: '',
			placeId: prediction.placeId
		}));
}

// Coordinates are deliberately fetched only on selection: one Place Details call
// per search instead of one per keystroke.
export async function resolveGooglePlace(placeId) {
	if (!placeId) return null;

	await loadGoogleMaps();
	const { Place } = await window.google.maps.importLibrary('places');

	const place = new Place({ id: placeId });
	await place.fetchFields({ fields: ['location', 'displayName', 'addressComponents'] });

	// The session ends with this call; the next search starts a fresh one.
	sessionToken = null;

	if (!place.location) return null;

	const components = place.addressComponents || [];
	const countryComponent = components.find(c => (c.types || []).includes('country'));

	return {
		lat: place.location.lat(),
		lon: place.location.lng(),
		name: place.displayName || '',
		country: countryComponent ? (countryComponent.longText || countryComponent.shortText || '') : ''
	};
}
