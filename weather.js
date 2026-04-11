// Open-Meteo weather API integration
// No API key required. CORS-safe for browser use.
// https://open-meteo.com/

const WEATHER_CACHE = {};

/**
 * Fetch 7-day hourly wind forecast + current conditions for a park.
 * Results are cached per park ID for the session.
 *
 * @param {object} park - Park object with coords: { lat, lon }
 * @returns {Promise<object>} Raw Open-Meteo response
 */
async function fetchParkWeather(park) {
  if (WEATHER_CACHE[park.id]) {
    return WEATHER_CACHE[park.id];
  }

  const { lat, lon } = park.coords;
  const url = [
    "https://api.open-meteo.com/v1/forecast",
    `?latitude=${lat}`,
    `&longitude=${lon}`,
    "&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation,weather_code",
    "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation_probability,weather_code",
    "&wind_speed_unit=mph",
    "&forecast_days=7",
    "&timezone=Europe%2FLondon"
  ].join("");

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Weather fetch failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  WEATHER_CACHE[park.id] = data;
  return data;
}

/**
 * Extract current live wind conditions from a weather response.
 * @param {object} data - Raw Open-Meteo response
 * @returns {{ speedMph: number, fromDeg: number, gustsMph: number }}
 */
function getCurrentWind(data) {
  const c = data.current;
  return {
    speedMph:    Math.round(c.wind_speed_10m),
    fromDeg:     Math.round(c.wind_direction_10m),
    gustsMph:    Math.round(c.wind_gusts_10m),
    tempC:       c.temperature_2m,
    precipMm:    c.precipitation,
    weatherCode: c.weather_code
  };
}

/**
 * Extract wind at a specific date/hour from the hourly forecast.
 * @param {object} data - Raw Open-Meteo response
 * @param {string} isoDate - "YYYY-MM-DD"
 * @param {number} hour    - 0–23
 * @returns {{ speedMph: number, fromDeg: number, gustsMph: number } | null}
 */
function getForecastWind(data, isoDate, hour) {
  const target = `${isoDate}T${String(hour).padStart(2, "0")}:00`;
  const idx = data.hourly.time.indexOf(target);
  if (idx === -1) return null;
  return {
    speedMph:    Math.round(data.hourly.wind_speed_10m[idx]),
    fromDeg:     Math.round(data.hourly.wind_direction_10m[idx]),
    gustsMph:    Math.round(data.hourly.wind_gusts_10m[idx]),
    tempC:       data.hourly.temperature_2m[idx],
    precipProb:  data.hourly.precipitation_probability[idx],
    weatherCode: data.hourly.weather_code[idx]
  };
}

/**
 * Convert a WMO weather code to a simple emoji icon.
 * @param {number} code
 * @returns {string}
 */
function getWeatherIcon(code) {
  if (code === 0)         return "\u2600\ufe0f";  // ☀️ clear
  if (code <= 2)          return "\uD83C\uDF24\ufe0f"; // 🌤️ mainly clear
  if (code <= 3)          return "\u2601\ufe0f";  // ☁️ overcast
  if (code <= 48)         return "\uD83C\uDF2B\ufe0f"; // 🌫️ fog
  if (code <= 67)         return "\uD83C\uDF27\ufe0f"; // 🌧️ drizzle/rain
  if (code <= 77)         return "\uD83C\uDF28\ufe0f"; // 🌨️ snow
  if (code <= 82)         return "\uD83C\uDF26\ufe0f"; // 🌦️ showers
  return "\u26C8\ufe0f";                          // ⛈️ thunderstorm
}

/**
 * Build a list of unique dates available in the hourly forecast.
 * @param {object} data - Raw Open-Meteo response
 * @returns {string[]} Array of "YYYY-MM-DD" strings
 */
function getForecastDates(data) {
  const dates = new Set();
  for (const t of data.hourly.time) {
    dates.add(t.slice(0, 10));
  }
  return Array.from(dates);
}

/**
 * Invalidate the weather cache for a park (forces a re-fetch).
 * @param {string} parkId
 */
function clearWeatherCache(parkId) {
  delete WEATHER_CACHE[parkId];
}
