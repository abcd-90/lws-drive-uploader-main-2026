const LS_API_KEY = "lws_google_api_key";

export function getSavedGoogleApiKey() {
  return localStorage.getItem(LS_API_KEY) || "";
}

export function saveGoogleApiKey(apiKey: string) {
  localStorage.setItem(LS_API_KEY, apiKey.trim());
}
