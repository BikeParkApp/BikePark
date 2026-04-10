// Wind direction and impact calculation utilities

/**
 * Calculate wind impact on a trail.
 * @param {number|null} trailHeadingDeg - Direction the rider travels (0=N, 90=E, etc.)
 * @param {number} windFromDeg - Meteorological wind direction (wind is coming FROM this direction)
 * @returns {{ status: string, angleDiff: number|null }}
 */
function getWindImpact(trailHeadingDeg, windFromDeg) {
  if (trailHeadingDeg === null || trailHeadingDeg === undefined) {
    return { status: "unknown", angleDiff: null };
  }

  // Wind FROM X degrees means the air is moving TOWARDS (X + 180)
  const windTowardsDeg = (windFromDeg + 180) % 360;

  // Angle between trail heading and wind direction
  let diff = Math.abs(trailHeadingDeg - windTowardsDeg);
  if (diff > 180) diff = 360 - diff;

  let status;
  if (diff <= 45) {
    status = "headwind";   // Wind blowing into the rider
  } else if (diff >= 135) {
    status = "tailwind";   // Wind pushing the rider
  } else {
    status = "crosswind";  // Most dangerous for jumps
  }

  return { status, angleDiff: Math.round(diff) };
}

/**
 * Convert degrees to 16-point cardinal direction.
 * @param {number} deg - 0–360
 * @returns {string} e.g. "NNE", "SW"
 */
function toCardinal(deg) {
  const dirs = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

/**
 * Classify wind speed into a severity label.
 * @param {number} speedMph
 * @returns {string} "calm" | "light" | "moderate" | "strong" | "severe"
 */
function getWindSeverity(speedMph) {
  if (speedMph < 4)  return "calm";
  if (speedMph < 13) return "light";
  if (speedMph < 25) return "moderate";
  if (speedMph < 39) return "strong";
  return "severe";
}

/**
 * Return a user-facing label + icon for a wind impact status.
 * @param {string} status - "headwind" | "tailwind" | "crosswind" | "unknown"
 * @returns {{ label: string, icon: string, css: string }}
 */
function getImpactDisplay(status) {
  switch (status) {
    case "headwind":
      return { label: "Headwind", icon: "↑", css: "headwind" };
    case "tailwind":
      return { label: "Tailwind", icon: "↓", css: "tailwind" };
    case "crosswind":
      return { label: "Crosswind", icon: "↔", css: "crosswind" };
    default:
      return { label: "Not set", icon: "?", css: "unknown" };
  }
}
