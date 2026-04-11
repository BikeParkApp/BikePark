// ============================================================
//  Bike Wind Checker — main application controller
//  Depends on: parks.js, wind.js, weather.js (loaded before)
// ============================================================

const state = {
  parkId:             Object.keys(PARKS)[0],
  weatherData:        null,
  headings:           {},   // { trailId: degrees }
  adminMode:          false,
  editingTrailId:     null,
  editingHeading:     0,
  useCurrentWeather:  true,
  forecastDate:       null,
  forecastHour:       null,
  expandedTrailId:    null  // trail detail panel currently open
};

// ── Local storage ─────────────────────────────────────────────

function storageKey(parkId) {
  return `bikewind_headings_${parkId}`;
}

function loadHeadings(parkId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(parkId)) || "{}");
  } catch (e) {
    return {};
  }
}

function saveHeadings(parkId, headings) {
  localStorage.setItem(storageKey(parkId), JSON.stringify(headings));
}

// ── Park selector ─────────────────────────────────────────────

function renderParkSelector() {
  const sel = document.getElementById("park-selector");
  sel.innerHTML = "";
  Object.values(PARKS).forEach(function(park) {
    const opt = document.createElement("option");
    opt.value = park.id;
    opt.textContent = park.name;
    if (park.id === state.parkId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function onParkChange(parkId) {
  state.parkId = parkId;
  state.headings = loadHeadings(parkId);
  state.weatherData = null;
  state.useCurrentWeather = true;
  clearWeatherCache(parkId);

  const park = PARKS[parkId];
  document.getElementById("park-name").textContent = park.name;
  document.getElementById("trail-map").src = park.mapImage;
  document.getElementById("trail-map").alt = park.name + " trail map";
  document.getElementById("forecast-label").textContent = "";

  renderTrailList(null);
  fetchAndRenderWeather();
}

// ── Weather ───────────────────────────────────────────────────

function fetchAndRenderWeather() {
  const park = PARKS[state.parkId];
  const loadingEl = document.getElementById("weather-loading");
  const errorEl   = document.getElementById("weather-error");
  const contentEl = document.getElementById("weather-content");

  loadingEl.style.display = "block";
  errorEl.style.display   = "none";
  contentEl.style.display = "none";

  fetchParkWeather(park)
    .then(function(data) {
      state.weatherData = data;
      renderForecastControls(data);
      state.useCurrentWeather = true;
      updateWeatherDisplay(getCurrentWind(data));
      loadingEl.style.display = "none";
      contentEl.style.display = "";
    })
    .catch(function(err) {
      console.error("Weather fetch error:", err);
      loadingEl.style.display = "none";
      errorEl.style.display   = "block";
      errorEl.textContent = "Could not load weather. Check your connection and try refreshing.";
    });
}

function updateWeatherDisplay(wind) {
  document.getElementById("wind-speed-val").textContent = wind.speedMph;
  document.getElementById("wind-from-val").textContent  =
    "From " + toCardinal(wind.fromDeg) + " (" + wind.fromDeg + "\xb0)";
  document.getElementById("wind-gusts-val").textContent =
    "Gusts: " + wind.gustsMph + " mph";

  var sev    = getWindSeverity(wind.speedMph);
  var sevEl  = document.getElementById("wind-severity");
  sevEl.textContent = sev.charAt(0).toUpperCase() + sev.slice(1);
  sevEl.className   = "severity-label sev-" + sev;

  // Rotate compass rose arrow to point FROM wind source
  var arrow = document.getElementById("wind-rose-arrow");
  if (arrow) {
    arrow.setAttribute("transform", "rotate(" + wind.fromDeg + ", 80, 80)");
  }

  // Weather conditions (temp + icon + rain)
  var condEl = document.getElementById("weather-conditions");
  if (condEl) {
    if (wind.weatherCode !== undefined && wind.weatherCode !== null) {
      var icon = getWeatherIcon(wind.weatherCode);
      var temp = wind.tempC !== undefined ? Math.round(wind.tempC) + "\xb0C" : "";
      var rain = wind.precipProb !== undefined
        ? wind.precipProb + "% rain"
        : (wind.precipMm > 0 ? wind.precipMm.toFixed(1) + "mm rain" : "");
      condEl.textContent = [icon, temp, rain].filter(Boolean).join("  \xb7  ");
    } else {
      condEl.textContent = "";
    }
  }

  updateMapWindOverlay(wind);
  renderTrailList(wind);
}

function updateMapWindOverlay(wind) {
  var overlay = document.getElementById("map-wind-overlay");
  if (!overlay) return;
  if (!wind) { overlay.classList.add("hidden"); return; }

  overlay.classList.remove("hidden");

  // Rotate the whole compass to match the park map's orientation.
  // mapNorthDeg = degrees CW to rotate so the N label points toward map-North.
  // e.g. Twisted Oaks has N on the left → mapNorthDeg: 270
  var park = PARKS[state.parkId];
  var mapNorthDeg = (park && park.mapNorthDeg) || 0;

  var orientGroup = document.getElementById("map-compass-orient");
  if (orientGroup) orientGroup.setAttribute("transform", "rotate(" + mapNorthDeg + ", 40, 40)");

  // Wind arrow sits inside the orient group — its rotation is relative to that group,
  // so the absolute screen direction = mapNorthDeg + fromDeg (correct map alignment).
  var arrow = document.getElementById("map-wind-arrow");
  if (arrow) arrow.setAttribute("transform", "rotate(" + wind.fromDeg + ", 40, 40)");

  var label = document.getElementById("map-wind-label");
  if (label) label.textContent = Math.round(wind.speedMph) + " mph " + toCardinal(wind.fromDeg);
}

function getActiveWind() {
  if (!state.weatherData) return null;
  if (state.useCurrentWeather) return getCurrentWind(state.weatherData);
  return getForecastWind(state.weatherData, state.forecastDate, state.forecastHour);
}

// ── Forecast controls ─────────────────────────────────────────

function renderForecastControls(data) {
  var dates      = getForecastDates(data);
  var dateSelect = document.getElementById("date-select");
  var timeSelect = document.getElementById("time-select");

  dateSelect.innerHTML = "";
  dates.forEach(function(d) {
    var opt  = document.createElement("option");
    opt.value = d;
    // e.g. "Mon 13 Apr"
    var dt = new Date(d + "T12:00:00");
    opt.textContent = dt.toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short"
    });
    dateSelect.appendChild(opt);
  });

  if (dates.length) {
    state.forecastDate = dates[0];
    dateSelect.value   = dates[0];
  }

  timeSelect.innerHTML = "";
  for (var h = 0; h < 24; h++) {
    var opt = document.createElement("option");
    opt.value = h;
    opt.textContent = ("0" + h).slice(-2) + ":00";
    timeSelect.appendChild(opt);
  }

  // Pre-select current hour
  var nowHour = new Date().getHours();
  state.forecastHour = nowHour;
  timeSelect.value   = nowHour;
}

function onForecastCheck() {
  if (!state.weatherData) return;

  state.forecastDate = document.getElementById("date-select").value;
  state.forecastHour = parseInt(document.getElementById("time-select").value, 10);
  state.useCurrentWeather = false;

  var wind = getForecastWind(state.weatherData, state.forecastDate, state.forecastHour);
  if (!wind) {
    document.getElementById("forecast-label").textContent = "No data for that time slot";
    return;
  }

  var dateEl = document.getElementById("date-select");
  var dateLabel = dateEl.options[dateEl.selectedIndex].text;
  var timeStr   = ("0" + state.forecastHour).slice(-2) + ":00";
  document.getElementById("forecast-label").textContent =
    "Forecast: " + dateLabel + " at " + timeStr;

  updateWeatherDisplay(wind);
}

function onShowLive() {
  if (!state.weatherData) return;
  state.useCurrentWeather = true;
  document.getElementById("forecast-label").textContent = "";
  updateWeatherDisplay(getCurrentWind(state.weatherData));
}

// ── Difficulty helpers ────────────────────────────────────────

var DIFF_CLASS_MAP = {
  "green":  "green",
  "blue":   "blue",
  "blue+":  "bluep",
  "red":    "red",
  "red+":   "redp",
  "black":  "black",
  "black+": "blackp",
  "pro":    "pro",
  "mixed":  "mixed"
};

function getDiffDotClass(difficulty) {
  var key = difficulty ? DIFF_CLASS_MAP[difficulty] : null;
  return "diff-" + (key || "unknown");
}

function getDiffBadgeClass(difficulty) {
  var key = difficulty ? DIFF_CLASS_MAP[difficulty] : null;
  return "diff-badge-" + (key || "unknown");
}

// ── Heading helpers ───────────────────────────────────────────

/**
 * Return the heading for a trail: saved value → defaultHeading → null.
 */
function getTrailHeading(trail) {
  if (state.headings[trail.id] !== undefined) return state.headings[trail.id];
  if (trail.defaultHeading   !== undefined) return trail.defaultHeading;
  return null;
}

/**
 * True when the heading in use is only the park default (not manually confirmed).
 */
function isHeadingDefault(trail) {
  return state.headings[trail.id] === undefined && trail.defaultHeading !== undefined;
}

// ── Config export / import ───────────────────────────────────

/**
 * Download all park headings + trail order as bike-wind-config.json.
 * Put that file next to index.html — it auto-loads on the next visit
 * when the app is served via HTTP (e.g. python3 -m http.server 8080).
 */
function exportConfig() {
  var config = { version: 1, parks: {} };
  Object.keys(PARKS).forEach(function(parkId) {
    config.parks[parkId] = {
      headings: loadHeadings(parkId),
      order:    loadOrder(parkId)
    };
  });
  var json = JSON.stringify(config, null, 2);
  var blob = new Blob([json], { type: "application/json" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href     = url;
  a.download = "bike-wind-config.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showConfigMsg("Saved \u2713");
}

/** Load headings + order from a user-picked JSON file. */
function importConfig(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var config = JSON.parse(e.target.result);
      if (!config || !config.parks) throw new Error("Not a valid config file");

      Object.keys(config.parks).forEach(function(parkId) {
        if (!PARKS[parkId]) return;
        var data = config.parks[parkId];
        if (data.headings && typeof data.headings === "object") saveHeadings(parkId, data.headings);
        if (Array.isArray(data.order))                          saveOrder(parkId, data.order);
      });

      state.headings = loadHeadings(state.parkId);
      renderTrailList(getActiveWind());
      showConfigMsg("Loaded \u2713");
    } catch (err) {
      showConfigMsg("Failed: " + err.message, true);
    }
  };
  reader.readAsText(file);
}

/**
 * On startup, try to fetch bike-wind-config.json from the server.
 * Only fills localStorage when it is currently empty for that park —
 * anything already in localStorage takes priority.
 * Silently ignored when opening via file:// (browser security restriction).
 * Returns a Promise so init() can wait for it before rendering.
 */
function tryFetchConfig() {
  if (typeof fetch !== "function") return Promise.resolve();
  return fetch("bike-wind-config.json")
    .then(function(resp) {
      if (!resp.ok) return;
      return resp.json().then(function(config) {
        if (!config || !config.parks) return;
        Object.keys(config.parks).forEach(function(parkId) {
          if (!PARKS[parkId]) return;
          var data = config.parks[parkId];
          if (!localStorage.getItem(storageKey(parkId)) && data.headings) saveHeadings(parkId, data.headings);
          if (!localStorage.getItem(orderKey(parkId))   && data.order)    saveOrder(parkId, data.order);
        });
      });
    })
    .catch(function() {}); // no config.json or file:// restriction — silently skip
}

function showConfigMsg(msg, isError) {
  var el = document.getElementById("config-msg");
  if (!el) return;
  el.textContent = msg;
  el.className   = "config-msg" + (isError ? " error" : " ok");
  clearTimeout(showConfigMsg._t);
  showConfigMsg._t = setTimeout(function() {
    el.textContent = "";
    el.className   = "config-msg";
  }, 3000);
}

// ── Trail order ───────────────────────────────────────────────

function orderKey(parkId) { return "bikewind_order_" + parkId; }

function loadOrder(parkId) {
  try {
    var saved = JSON.parse(localStorage.getItem(orderKey(parkId)) || "null");
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return PARKS[parkId].trails.map(function(t) { return t.id; });
}

function saveOrder(parkId, order) {
  localStorage.setItem(orderKey(parkId), JSON.stringify(order));
}

/**
 * Return park trails sorted by the user's saved order.
 * Any trail added to parks.js after the order was saved is appended at the end.
 */
function getSortedTrails(park) {
  var order    = loadOrder(park.id);
  var trailMap = {};
  park.trails.forEach(function(t) { trailMap[t.id] = t; });

  var sorted = [];
  order.forEach(function(id) { if (trailMap[id]) sorted.push(trailMap[id]); });
  park.trails.forEach(function(t) { if (order.indexOf(t.id) === -1) sorted.push(t); });
  return sorted;
}

function moveTrail(trailId, delta) {
  var order = loadOrder(state.parkId);
  var idx   = order.indexOf(trailId);
  if (idx === -1) return;

  var target = idx + delta;
  if (target < 0 || target >= order.length) return;

  // Swap
  var tmp        = order[idx];
  order[idx]     = order[target];
  order[target]  = tmp;

  saveOrder(state.parkId, order);
  renderTrailList(getActiveWind());
}

// ── Trail list ────────────────────────────────────────────────

function renderTrailList(wind) {
  var list  = document.getElementById("trail-list");
  var park  = PARKS[state.parkId];
  list.innerHTML = "";

  var sorted    = getSortedTrails(park);
  var sortedLen = sorted.length;

  sorted.forEach(function(trail, trailIdx) {
    var heading  = getTrailHeading(trail);
    var diffClass = getDiffDotClass(trail.difficulty);
    var severity  = (wind && heading !== null) ? getWindSeverity(wind.speedMph) : null;
    var badgeHtml, headingLabel;

    if (trail.bidirectional) {
      // ── Out-and-back trail: show impact for both legs ──────────
      if (wind && heading !== null) {
        var returnHeading = (heading + 180) % 360;
        var outImpact  = getWindImpact(heading, wind.fromDeg);
        var retImpact  = getWindImpact(returnHeading, wind.fromDeg);
        var outDisplay = getImpactDisplay(outImpact.status);
        var retDisplay = getImpactDisplay(retImpact.status);
        var sevTag = severity ? ' <span class="severity-tag">(' + severity + ")</span>" : "";
        badgeHtml =
          '<div class="impact-pair">' +
          '<span class="impact-badge-mini ' + outDisplay.css + '" title="Outbound — ' + toCardinal(heading) + '">' +
            outDisplay.icon + " Out" + sevTag + "</span>" +
          '<span class="impact-badge-mini ' + retDisplay.css + '" title="Return — ' + toCardinal(returnHeading) + '">' +
            retDisplay.icon + " Back</span>" +
          "</div>";
      } else {
        badgeHtml = '<span class="impact-badge unknown">' + (wind ? "? Set dir" : "\u2013") + "</span>";
      }
      // Heading button shows outbound → return; ~ prefix = estimated, not confirmed
      var biPfx = (heading !== null && isHeadingDefault(trail)) ? "~" : "";
      headingLabel = heading !== null
        ? (biPfx + heading + "\xb0\u00a0" + toCardinal(heading) + " \u2192 " + ((heading + 180) % 360) + "\xb0\u00a0" + toCardinal((heading + 180) % 360))
        : "Set dir";

    } else {
      // ── Single-direction trail ─────────────────────────────────
      var impact  = wind ? getWindImpact(heading, wind.fromDeg) : { status: "unknown" };
      var display = getImpactDisplay(wind ? impact.status : "unknown");
      var badgeContent = wind
        ? (display.icon + " " + display.label + (severity ? ' <span class="severity-tag">(' + severity + ")</span>" : ""))
        : "\u2013";
      badgeHtml = '<span class="impact-badge ' + (wind ? display.css : "unknown") + '">' + badgeContent + "</span>";
      var snPfx = (heading !== null && isHeadingDefault(trail)) ? "~" : "";
      headingLabel = heading !== null
        ? (snPfx + heading + "\xb0 " + toCardinal(heading))
        : "Set dir";
    }

    var row = document.createElement("div");
    row.className = "trail-row" + (trail.bidirectional ? " bidirectional" : "");
    row.dataset.trailId = trail.id;
    row.innerHTML =
      '<span class="difficulty-dot ' + diffClass + '" title="' + (trail.difficulty || "ungraded") + '"></span>' +
      '<div class="trail-row-body">' +
        '<span class="trail-name">' + trail.name + '</span>' +
        '<div class="trail-row-controls">' +
          badgeHtml +
          '<button class="btn-edit-heading' + (isHeadingDefault(trail) ? ' heading-default' : '') + '" data-trail-id="' + trail.id + '">' + headingLabel + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="btn-move-group">' +
        '<button class="btn-move btn-move-up" data-trail-id="' + trail.id + '"' + (trailIdx === 0 ? ' disabled' : '') + ' title="Move up">\u25b2</button>' +
        '<button class="btn-move btn-move-down" data-trail-id="' + trail.id + '"' + (trailIdx === sortedLen - 1 ? ' disabled' : '') + ' title="Move down">\u25bc</button>' +
      '</div>';

    list.appendChild(row);
  });

  // Attach click handlers
  list.querySelectorAll(".trail-row").forEach(function(row) {
    row.addEventListener("click", function(e) {
      if (e.target.closest(".btn-edit-heading") || e.target.closest(".btn-move-group")) return;
      toggleTrailDetail(row.dataset.trailId);
    });
  });

  list.querySelectorAll(".btn-edit-heading").forEach(function(btn) {
    btn.addEventListener("click", function() {
      openCompassModal(btn.dataset.trailId);
    });
  });

  list.querySelectorAll(".btn-move-up").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      if (!btn.disabled) moveTrail(btn.dataset.trailId, -1);
    });
  });

  list.querySelectorAll(".btn-move-down").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      if (!btn.disabled) moveTrail(btn.dataset.trailId, 1);
    });
  });

  // Restore any open detail panel after a re-render (wind/forecast update)
  if (state.expandedTrailId) {
    openTrailDetail(state.expandedTrailId);
  }
}

// ── Trail detail panel ────────────────────────────────────────

/**
 * Build the small SVG compass showing wind (blue) and trail (gold) arrows.
 */
function buildDetailCompassSVG(trail, wind, heading) {
  var svg = '<svg class="detail-compass" viewBox="0 0 100 100" width="88" height="88" aria-hidden="true">';

  // Outer ring + N label
  svg += '<circle cx="50" cy="50" r="44" fill="none" stroke="#30363d" stroke-width="1"/>';
  svg += '<text x="50" y="9" text-anchor="middle" font-size="8" font-weight="700" fill="#555" font-family="sans-serif">N</text>';

  // Wind arrow — points FROM source direction (same convention as main compass)
  svg += '<g transform="rotate(' + wind.fromDeg + ', 50, 50)">';
  svg += '<line x1="50" y1="48" x2="50" y2="14" stroke="#4fc3f7" stroke-width="2.5" stroke-linecap="round"/>';
  svg += '<polygon points="50,7 45,18 55,18" fill="#4fc3f7"/>';
  svg += '</g>';

  if (heading !== null) {
    if (trail.bidirectional) {
      var returnHeading = (heading + 180) % 360;
      // Outbound leg — solid gold
      svg += '<g transform="rotate(' + heading + ', 50, 50)">';
      svg += '<line x1="50" y1="48" x2="50" y2="14" stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>';
      svg += '<polygon points="50,7 45,18 55,18" fill="#ffd700"/>';
      svg += '</g>';
      // Return leg — dashed gold
      svg += '<g transform="rotate(' + returnHeading + ', 50, 50)">';
      svg += '<line x1="50" y1="48" x2="50" y2="14" stroke="#ffd700" stroke-width="1.5" stroke-dasharray="3,3" stroke-linecap="round"/>';
      svg += '<polygon points="50,7 45,18 55,18" fill="rgba(255,215,0,0.4)"/>';
      svg += '</g>';
    } else {
      // Single direction — solid gold
      svg += '<g transform="rotate(' + heading + ', 50, 50)">';
      svg += '<line x1="50" y1="48" x2="50" y2="14" stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>';
      svg += '<polygon points="50,7 45,18 55,18" fill="#ffd700"/>';
      svg += '</g>';
    }
  }

  // Centre dot
  svg += '<circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.4)"/>';

  // Legend
  svg += '<circle cx="10" cy="95" r="3" fill="#4fc3f7"/>';
  svg += '<text x="15" y="98" font-size="7" fill="#4fc3f7" font-family="sans-serif">Wind</text>';
  if (heading !== null) {
    svg += '<circle cx="44" cy="95" r="3" fill="#ffd700"/>';
    svg += '<text x="49" y="98" font-size="7" fill="#ffd700" font-family="sans-serif">Trail</text>';
  }

  svg += '</svg>';
  return svg;
}

/**
 * One-line English note about the angle, e.g. "head-on", "45° off nose".
 */
function windAngleNote(status, angleDiff) {
  if (status === "headwind") {
    if (angleDiff <= 8)  return "head-on";
    if (angleDiff <= 20) return "nearly head-on (" + angleDiff + "\xb0)";
    return angleDiff + "\xb0 off your nose";
  }
  if (status === "tailwind") {
    var offTail = 180 - angleDiff;
    if (offTail <= 8)  return "straight behind";
    if (offTail <= 20) return "nearly straight behind (" + offTail + "\xb0)";
    return offTail + "\xb0 off your tail";
  }
  if (status === "crosswind") {
    if (angleDiff >= 80 && angleDiff <= 100) return "pure side-on (" + angleDiff + "\xb0)";
    return angleDiff + "\xb0 off your heading";
  }
  return "";
}

/**
 * Build the full detail panel HTML for a trail.
 */
function buildTrailDetailHTML(trail, wind, heading) {
  var html = '<div class="trail-detail">';

  if (!wind) {
    html += '<p class="detail-no-heading">No wind data loaded yet.</p>';
    html += '</div>';
    return html;
  }

  html += '<div class="detail-inner">';
  html += buildDetailCompassSVG(trail, wind, heading);
  html += '<div class="detail-text">';

  // Wind summary
  html += '<div class="detail-wind-info">';
  html += wind.speedMph + ' mph from ' + toCardinal(wind.fromDeg) + ' (' + wind.fromDeg + '\xb0)';
  html += '</div>';
  html += '<div class="detail-gusts">Gusts ' + wind.gustsMph + ' mph &middot; ' + getWindSeverity(wind.speedMph) + '</div>';

  html += '<hr class="detail-divider">';

  if (heading !== null) {
    if (trail.bidirectional) {
      var returnHeading = (heading + 180) % 360;
      var outImpact = getWindImpact(heading, wind.fromDeg);
      var retImpact = getWindImpact(returnHeading, wind.fromDeg);
      var outDisp   = getImpactDisplay(outImpact.status);
      var retDisp   = getImpactDisplay(retImpact.status);

      html += '<div class="detail-leg">';
      html += '<span class="detail-leg-label">Out &rarr; ' + toCardinal(heading) + ' (' + heading + '\xb0)</span>';
      html += '<div class="detail-leg-right">';
      html += '<span class="impact-badge-mini ' + outDisp.css + '">' + outDisp.icon + ' ' + outDisp.label + '</span>';
      html += '<span class="detail-angle-note">' + windAngleNote(outImpact.status, outImpact.angleDiff) + '</span>';
      html += '</div></div>';

      html += '<div class="detail-leg">';
      html += '<span class="detail-leg-label">Back &larr; ' + toCardinal(returnHeading) + ' (' + returnHeading + '\xb0)</span>';
      html += '<div class="detail-leg-right">';
      html += '<span class="impact-badge-mini ' + retDisp.css + '">' + retDisp.icon + ' ' + retDisp.label + '</span>';
      html += '<span class="detail-angle-note">' + windAngleNote(retImpact.status, retImpact.angleDiff) + '</span>';
      html += '</div></div>';

    } else {
      var impact  = getWindImpact(heading, wind.fromDeg);
      var display = getImpactDisplay(impact.status);
      html += '<div class="detail-heading-line">Trail runs ' + toCardinal(heading) + ' (' + heading + '\xb0)</div>';
      html += '<div class="detail-result-row">';
      html += '<span class="impact-badge ' + display.css + '">' + display.icon + ' ' + display.label + '</span>';
      html += '<span class="detail-angle-note">' + windAngleNote(impact.status, impact.angleDiff) + '</span>';
      html += '</div>';
    }
  } else {
    html += '<div class="detail-no-heading">Trail direction not set &mdash; tap <strong>Settings</strong> to configure.</div>';
  }

  html += '</div>'; // detail-text
  html += '</div>'; // detail-inner
  html += '</div>'; // trail-detail
  return html;
}

/**
 * Open (or refresh) the detail panel for a trail without toggling.
 * Called after re-renders to restore the previously open panel.
 */
function openTrailDetail(trailId) {
  var park  = PARKS[state.parkId];
  var trail = null;
  for (var i = 0; i < park.trails.length; i++) {
    if (park.trails[i].id === trailId) { trail = park.trails[i]; break; }
  }
  if (!trail) return;

  var heading    = getTrailHeading(trail);
  var wind       = getActiveWind();
  var detailRow  = document.createElement("div");
  detailRow.className       = "trail-detail-row";
  detailRow.dataset.forTrail = trailId;
  detailRow.innerHTML       = buildTrailDetailHTML(trail, wind, heading);

  var trailRow = document.querySelector('.trail-row[data-trail-id="' + trailId + '"]');
  if (!trailRow) return;

  trailRow.classList.add("expanded");
  trailRow.parentNode.insertBefore(detailRow, trailRow.nextSibling);
}

/**
 * Toggle the detail panel for a trail row.
 * Closes any other open panel first.
 */
function toggleTrailDetail(trailId) {
  var existing = document.querySelector(".trail-detail-row");

  if (existing) {
    var wasThisTrail = existing.dataset.forTrail === trailId;
    // Close the open panel (and un-highlight its trail row)
    var oldRow = document.querySelector('.trail-row[data-trail-id="' + existing.dataset.forTrail + '"]');
    if (oldRow) oldRow.classList.remove("expanded");
    existing.remove();
    state.expandedTrailId = null;
    if (wasThisTrail) return; // clicked same trail → just close
  }

  // Open the new trail's detail
  state.expandedTrailId = trailId;
  openTrailDetail(trailId);
}

// ── Admin mode ────────────────────────────────────────────────

function toggleAdminMode() {
  state.adminMode = !state.adminMode;

  var list    = document.getElementById("trail-list");
  var sidebar = document.getElementById("sidebar");
  var btn     = document.getElementById("btn-admin-toggle");

  if (state.adminMode) {
    list.classList.add("admin-mode");
    sidebar.classList.add("admin-mode");
    btn.classList.add("active");
    btn.innerHTML = "<span>\u2713</span> Done";
  } else {
    list.classList.remove("admin-mode");
    sidebar.classList.remove("admin-mode");
    btn.classList.remove("active");
    btn.innerHTML = "<span>\u2699</span> Settings";
  }
}

// ── Compass modal ─────────────────────────────────────────────

var compassDragging = false;

function openCompassModal(trailId) {
  var park  = PARKS[state.parkId];
  var trail = null;
  for (var i = 0; i < park.trails.length; i++) {
    if (park.trails[i].id === trailId) { trail = park.trails[i]; break; }
  }
  if (!trail) return;

  state.editingTrailId  = trailId;
  state.editingHeading  = getTrailHeading(trail) !== null ? getTrailHeading(trail) : 0;

  document.getElementById("modal-trail-name").textContent = trail.name;
  document.getElementById("modal-diff-label").textContent = trail.difficulty ? trail.difficulty.toUpperCase() : "";
  document.getElementById("modal-diff-label").className =
    "modal-diff " + getDiffBadgeClass(trail.difficulty);

  // Subtitle changes for bidirectional trails
  document.getElementById("modal-subtitle").textContent = trail.bidirectional
    ? "Set the outbound direction \u2014 return leg is calculated automatically"
    : "Drag to set the direction the rider travels";

  updateAdminNeedle(state.editingHeading);
  document.getElementById("compass-modal").classList.remove("hidden");
}

function closeCompassModal() {
  document.getElementById("compass-modal").classList.add("hidden");
  state.editingTrailId = null;
  compassDragging = false;
}

function onModalSave() {
  if (state.editingTrailId === null) return;
  state.headings[state.editingTrailId] = state.editingHeading;
  saveHeadings(state.parkId, state.headings);
  closeCompassModal();
  var wind = getActiveWind();
  renderTrailList(wind);
}

// ── Admin compass interaction ─────────────────────────────────

function buildCompassTicks() {
  var svg    = document.getElementById("admin-compass");
  var ns     = "http://www.w3.org/2000/svg";
  var cx     = 120, cy = 120;
  var needle = document.getElementById("compass-needle");

  for (var deg = 0; deg < 360; deg += 10) {
    var rad      = (deg - 90) * Math.PI / 180;
    var isMajor  = (deg % 90 === 0);
    var isMinor4 = (deg % 45 === 0);
    var inner    = isMajor ? 76 : (isMinor4 ? 79 : 83);
    var outer    = 90;

    var x1 = cx + inner * Math.cos(rad);
    var y1 = cy + inner * Math.sin(rad);
    var x2 = cx + outer * Math.cos(rad);
    var y2 = cy + outer * Math.sin(rad);

    var line = document.createElementNS(ns, "line");
    line.setAttribute("x1", x1.toFixed(1));
    line.setAttribute("y1", y1.toFixed(1));
    line.setAttribute("x2", x2.toFixed(1));
    line.setAttribute("y2", y2.toFixed(1));
    line.setAttribute("stroke", isMajor ? "#4a5568" : (isMinor4 ? "#3a3f48" : "#2d3139"));
    line.setAttribute("stroke-width", isMajor ? "2" : "1");

    svg.insertBefore(line, needle);
  }
}

function getCompassBearing(svgEl, e) {
  var rect    = svgEl.getBoundingClientRect();
  var cx      = rect.left + rect.width  / 2;
  var cy      = rect.top  + rect.height / 2;
  var clientX = e.touches ? e.touches[0].clientX : e.clientX;
  var clientY = e.touches ? e.touches[0].clientY : e.clientY;
  var dx      = clientX - cx;
  var dy      = clientY - cy;
  // atan2(dx, -dy) gives compass bearing 0=N, 90=E, 180=S, 270=W
  var bearing = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  return Math.round(bearing);
}

function updateAdminNeedle(heading) {
  var needle = document.getElementById("compass-needle");
  if (needle) {
    needle.setAttribute("transform", "rotate(" + heading + ", 120, 120)");
  }
  document.getElementById("heading-display").textContent =
    heading + "\xb0 " + toCardinal(heading);
}

function initCompassDrag() {
  var svg = document.getElementById("admin-compass");
  if (!svg) return;

  svg.addEventListener("mousedown", function(e) {
    compassDragging = true;
    state.editingHeading = getCompassBearing(svg, e);
    updateAdminNeedle(state.editingHeading);
    e.preventDefault();
  });

  svg.addEventListener("touchstart", function(e) {
    compassDragging = true;
    state.editingHeading = getCompassBearing(svg, e);
    updateAdminNeedle(state.editingHeading);
  }, { passive: true });

  document.addEventListener("mousemove", function(e) {
    if (!compassDragging) return;
    state.editingHeading = getCompassBearing(svg, e);
    updateAdminNeedle(state.editingHeading);
  });

  document.addEventListener("touchmove", function(e) {
    if (!compassDragging) return;
    state.editingHeading = getCompassBearing(svg, e);
    updateAdminNeedle(state.editingHeading);
  }, { passive: true });

  document.addEventListener("mouseup",  function() { compassDragging = false; });
  document.addEventListener("touchend", function() { compassDragging = false; });
}

// ── Init ──────────────────────────────────────────────────────

function init() {
  // Load persisted trail headings for the default park
  state.headings = loadHeadings(state.parkId);

  // Populate park selector
  renderParkSelector();

  // Set initial heading in header
  var park = PARKS[state.parkId];
  document.getElementById("park-name").textContent = park.name;

  // Set map
  var mapImg = document.getElementById("trail-map");
  mapImg.src = park.mapImage;
  mapImg.alt = park.name + " trail map";

  // Build admin compass tick marks
  buildCompassTicks();

  // Wire up compass drag events
  initCompassDrag();

  // Park selector change
  document.getElementById("park-selector").addEventListener("change", function(e) {
    onParkChange(e.target.value);
  });

  // Forecast controls
  document.getElementById("btn-forecast").addEventListener("click", onForecastCheck);
  document.getElementById("btn-live").addEventListener("click", onShowLive);

  // Admin mode toggle
  document.getElementById("btn-admin-toggle").addEventListener("click", toggleAdminMode);

  // Compass modal buttons
  document.getElementById("btn-modal-save").addEventListener("click", onModalSave);
  document.getElementById("btn-modal-cancel").addEventListener("click", closeCompassModal);

  // Close modal when clicking the overlay backdrop
  document.getElementById("compass-modal").addEventListener("click", function(e) {
    if (e.target === this) closeCompassModal();
  });

  // Keyboard: close modal on Escape
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeCompassModal();
  });

  // Config save / load buttons
  document.getElementById("btn-export").addEventListener("click", exportConfig);
  document.getElementById("config-file-input").addEventListener("change", function(e) {
    if (e.target.files && e.target.files[0]) {
      importConfig(e.target.files[0]);
      e.target.value = ""; // reset so same file can be re-loaded
    }
  });

  // Try to auto-load config.json, then render everything
  tryFetchConfig().then(function() {
    state.headings = loadHeadings(state.parkId); // refresh — config may have just loaded
    renderTrailList(null);
    fetchAndRenderWeather();
  });
}

document.addEventListener("DOMContentLoaded", init);
