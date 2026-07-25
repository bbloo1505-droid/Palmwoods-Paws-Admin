import { useEffect, useRef, useState } from "react";
import { appendWalkPoint } from "@/lib/api";

type GpsStatus = "idle" | "watching" | "denied" | "unsupported" | "error";

/** Foreground GPS tracking for V1 (works while the app stays open). */
export function useWalkGps(walkId: string | null, enabled: boolean) {
  const [status, setStatus] = useState<GpsStatus>("idle");
  const [pointCount, setPointCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSaved = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled || !walkId) {
      if (watchId.current != null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      setStatus("idle");
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    setStatus("watching");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const now = Date.now();
        const prev = lastSaved.current;
        // Throttle: every ~8s or ~12m of movement
        const moved =
          !prev ||
          Math.hypot(lat - prev.lat, lng - prev.lng) * 111_000 > 12 ||
          now - prev.at > 8000;
        if (!moved) return;

        lastSaved.current = { lat, lng, at: now };
        void appendWalkPoint(walkId, {
          lat,
          lng,
          accuracy: pos.coords.accuracy,
        })
          .then(() => setPointCount((c) => c + 1))
          .catch((e) => setLastError(e instanceof Error ? e.message : "GPS save failed"));
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("error");
        setLastError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [walkId, enabled]);

  return { status, pointCount, lastError };
}
