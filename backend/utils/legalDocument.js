function normalizeUrl(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function readStoredUrl(settings, primaryKey, legacyKey) {
  if (settings[primaryKey] !== null && settings[primaryKey] !== undefined) {
    return normalizeUrl(settings[primaryKey]);
  }

  return normalizeUrl(settings[legacyKey]);
}

function readProvidedUrl(body, keys, fallback) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return normalizeUrl(body[key]);
    }
  }

  return fallback;
}

export function normalizeLegalDocumentUrls(settings = {}) {
  return {
    powerOfAttorneyUrl: readStoredUrl(
      settings,
      'powerOfAttorneyUrl',
      'powerOfAttorneyDocumentUrl'
    ),
    passengerRightsUrl: readStoredUrl(
      settings,
      'rightsDocumentUrl',
      'passengerRightsUrl'
    ),
  };
}

export function resolveLegalDocumentUrls(body = {}, currentSettings = {}) {
  const current = normalizeLegalDocumentUrls(currentSettings);

  return {
    powerOfAttorneyUrl: readProvidedUrl(
      body,
      ['powerOfAttorneyUrl', 'powerOfAttorneyDocumentUrl'],
      current.powerOfAttorneyUrl
    ),
    passengerRightsUrl: readProvidedUrl(
      body,
      ['passengerRightsUrl', 'rightsDocumentUrl'],
      current.passengerRightsUrl
    ),
  };
}

export function mapLegalDocumentResponse(settings = {}) {
  const documents = normalizeLegalDocumentUrls(settings);

  return {
    ...documents,
    // Keep the names emitted by older browser bundles available while the
    // canonical API names remain passengerRightsUrl/powerOfAttorneyUrl.
    rightsDocumentUrl: documents.passengerRightsUrl,
    powerOfAttorneyDocumentUrl: documents.powerOfAttorneyUrl,
  };
}
