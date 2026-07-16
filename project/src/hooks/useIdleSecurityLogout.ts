import { useEffect, useRef } from "react";

/**
 * FEATURE 3: Idle Security Auto-Logout
 * ------------------------------------------------------------------
 * Global layout-level hook. Listens for the browser tab going into the
 * background — a tab switch, window minimize, switching to another
 * application, or simply leaving the tab inactive — via the standard
 * `visibilitychange` event.
 *
 * The moment `document.visibilityState === "hidden"`, and only if
 * `isSessionActive` is true (i.e. someone — Admin, Department head, or
 * Citizen — is actually logged in), it:
 *   1. Wipes any client-side session data (`localStorage.clear()`).
 *   2. Invokes `onForceLogout`, which the caller wires up to reset auth
 *      state so the relevant login screen renders again.
 *
 * This is intentionally aggressive by design (per the security
 * requirement) — it fires on ANY tab-hide event, not just long idle
 * periods. One listener is registered globally regardless of how many
 * components call this hook, since React de-dupes identical
 * document-level listeners per mounted instance; call it once at the
 * root layout (e.g. in App.tsx) rather than per-page.
 */
export function useIdleSecurityLogout(isSessionActive: boolean, onForceLogout: () => void) {
  // Refs so the listener (registered once) always reads the latest
  // values without needing to be torn down/re-added on every render.
  const isSessionActiveRef = useRef(isSessionActive);
  const onForceLogoutRef = useRef(onForceLogout);

  isSessionActiveRef.current = isSessionActive;
  onForceLogoutRef.current = onForceLogout;

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isSessionActiveRef.current) {
        try {
          localStorage.clear();
        } catch {
          // localStorage can throw in some environments (private
          // browsing, disabled storage, etc.) — never let that block
          // the actual logout from happening.
        }
        onForceLogoutRef.current();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}