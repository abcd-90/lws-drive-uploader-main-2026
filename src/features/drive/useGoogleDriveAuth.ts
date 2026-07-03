import { useCallback, useEffect, useMemo, useState } from "react";

export type DriveAuthState = {
  connected: boolean;
  accessToken: string | null;
  expiresAt: number | null; // epoch ms
  error: string | null;
};

const LS_CLIENT_ID = "lws_google_client_id";
const LS_ACCESS_TOKEN = "lws_drive_access_token";
const LS_EXPIRES_AT = "lws_drive_expires_at";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src=\"${src}\"]`);
    if (existing) return resolve();

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google OAuth script"));
    document.head.appendChild(script);
  });
}

function nowMs() {
  return Date.now();
}

function isTokenValid(accessToken: string | null, expiresAt: number | null) {
  if (!accessToken || !expiresAt) return false;
  // small buffer
  return expiresAt - 30_000 > nowMs();
}

export function getSavedGoogleClientId() {
  return localStorage.getItem(LS_CLIENT_ID) || "";
}

export function saveGoogleClientId(clientId: string) {
  localStorage.setItem(LS_CLIENT_ID, clientId.trim());
}

export function clearDriveAuth() {
  localStorage.removeItem(LS_ACCESS_TOKEN);
  localStorage.removeItem(LS_EXPIRES_AT);
}

export function useGoogleDriveAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(LS_ACCESS_TOKEN));
  const [expiresAt, setExpiresAt] = useState<number | null>(() => {
    const raw = localStorage.getItem(LS_EXPIRES_AT);
    return raw ? Number(raw) : null;
  });
  const [error, setError] = useState<string | null>(null);

  const isInIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const connected = useMemo(() => isTokenValid(accessToken, expiresAt), [accessToken, expiresAt]);

  // Clean up expired token
  useEffect(() => {
    if (!connected && (accessToken || expiresAt)) {
      clearDriveAuth();
      setAccessToken(null);
      setExpiresAt(null);
    }
  }, [connected]);

  const requestToken = useCallback(
    async (opts: { prompt?: "consent" | "none" | ""; loginHint?: string } = {}) => {
      setError(null);

      // Google blocks some auth flows inside iframes (shows accounts.google.com blocked).
      if (isInIframe) {
        setError("Google Drive connection is blocked inside previews. Please open the site in a new browser tab and try connecting again.");
        return;
      }

      const clientId = getSavedGoogleClientId();
      if (!clientId) {
        setError("Google Client ID missing. Please add it first.");
        return;
      }

      await loadScript("https://accounts.google.com/gsi/client");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleAny = (window as any).google;
      if (!googleAny?.accounts?.oauth2?.initTokenClient) {
        setError("Google OAuth is not available. Please refresh and try again.");
        return;
      }

      let callbackCalled = false;
      const timeout = window.setTimeout(() => {
        if (!callbackCalled) {
          setError(
            "Google popup window might be blocked. Please check your browser's address bar to allow popups, disable AdBlock, and enable third-party cookies.",
          );
        }
      }, 25_000);

      const tokenClient = googleAny.accounts.oauth2.initTokenClient({
        client_id: clientId,
        // Needed to read/copy files from public/shared folders and create them in user's Drive.
        // `drive.file` is too restrictive (only app-created/opened files), which causes "some files not cloning".
        scope: "https://www.googleapis.com/auth/drive",
        callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
          callbackCalled = true;
          window.clearTimeout(timeout);
          setError(null); // Clear any timeout error

          // Silent attempt can return interaction_required; don't show scary errors.
          if (resp?.error) {
            const err = String(resp.error);

            // Silent attempt can return interaction_required; don't show scary errors.
            if (opts.prompt === "" || opts.prompt === "none") {
              // keep it quiet; UI will show a connect button
              setError(null);
              return;
            }

            // Friendly messages for common Google Console mis-config
            if (err.toLowerCase().includes("redirect_uri_mismatch")) {
              setError(
                "Google OAuth setup mismatch (redirect_uri_mismatch). The site owner must add this domain to the Authorized JavaScript origins in the Google Cloud Console.",
              );
              return;
            }

            if (err.toLowerCase().includes("invalid_request")) {
              setError(
                "Google OAuth request is invalid (invalid_request). Please ensure the site's domain is correctly registered in the Google Cloud Console credentials.",
              );
              return;
            }

            setError(err);
            return;
          }

          const token = resp?.access_token;
          const expiresInSec = resp?.expires_in ?? 0;
          if (!token || !expiresInSec) {
            if (opts.prompt === "" || opts.prompt === "none") {
              setError(null);
              return;
            }
            setError("No access token returned by Google.");
            return;
          }

          const exp = nowMs() + expiresInSec * 1000;
          localStorage.setItem(LS_ACCESS_TOKEN, token);
          localStorage.setItem(LS_EXPIRES_AT, String(exp));
          setAccessToken(token);
          setExpiresAt(exp);
        },
      });

      try {
        // Use login hint so Drive connects with the same email used to login to the app.
        tokenClient.requestAccessToken({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(opts.loginHint ? ({ hint: opts.loginHint } as any) : {}),
          prompt: opts.prompt ?? "consent",
        });
      } catch (e) {
        callbackCalled = true;
        window.clearTimeout(timeout);
        if (opts.prompt === "" || opts.prompt === "none") {
          setError(null);
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [isInIframe],
  );

  const connect = useCallback(
    async (loginHint?: string) => {
      await requestToken({ prompt: "consent", loginHint });
    },
    [requestToken],
  );

  // Tries to connect without showing consent (works only if user already granted access)
  const connectSilently = useCallback(
    async (loginHint?: string) => {
      await requestToken({ prompt: "", loginHint });
    },
    [requestToken],
  );

  const disconnect = useCallback(() => {
    clearDriveAuth();
    setAccessToken(null);
    setExpiresAt(null);
    setError(null);
  }, []);

  return {
    connected,
    accessToken,
    expiresAt,
    error,
    isInIframe,
    connect,
    connectSilently,
    disconnect,
  } satisfies DriveAuthState & {
    isInIframe: boolean;
    connect: (loginHint?: string) => Promise<void>;
    connectSilently: (loginHint?: string) => Promise<void>;
    disconnect: () => void;
  };
}
