import { query } from '../config/db.js';
import { getCachedFlightStatuses, syncFlightFeeds } from '../services/flightCacheService.js';
import { parseFlightLimit } from '../services/externalFlightService.js';

function mapLocalFlightStatus(flight) {
  return {
    id: flight.id,
    routeFrom: flight.routeFrom,
    routeTo: flight.routeTo,
    route: flight.route || '',
    flightNumber: flight.flightNumber,
    airline: flight.airline || '',
    scheduledTime: flight.scheduledTime,
    statusText: flight.statusText,
    statusType: flight.statusType,
  };
}

export async function publicFlightStatuses(req, res) {
  const limit = parseFlightLimit(req.query.limit);
  const cachedFlights = await getCachedFlightStatuses(limit);

  if (cachedFlights.length > 0) {
    res.set('X-Data-Source', 'flight-cache');
    res.json(cachedFlights);
    return;
  }

  // Kick one safe background sync so the next request can read from our DB.
  syncFlightFeeds({ limit }).catch((error) => {
    console.warn(`[flight-cache] background public sync failed: ${error.message}`);
  });

  const localFlights = await query(
    'SELECT * FROM FlightStatus ORDER BY createdAt DESC LIMIT ?',
    [limit]
  );

  res.set('X-Data-Source', localFlights.length ? 'local-fallback' : 'empty-cache');
  res.json(localFlights.map(mapLocalFlightStatus));
}
