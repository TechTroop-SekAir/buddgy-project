import api from './api';

// GET /api/forecast?month= — docs/API.md § Calendar & Forecast (ticket B-07,
// done). `recommendation` comes back as a structured object
// ({ envelopeId, envelopeName, cutAgorot }), not a finished sentence — the
// caller interpolates it via the `forecast.recommendation` i18n key
// (client/src/locales/*.json), since the app defaults to Hebrew.
async function getForecast(month) {
  return api.get('/forecast', { params: { month } });
}

const forecastService = { getForecast };

export default forecastService;
