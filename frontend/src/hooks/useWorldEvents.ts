import { useEffect, useRef } from 'react';
import { WS_BASE_URL } from '../config';
import { useEventStore } from '../state/eventStore';
import { useWorldStore } from '../state/worldStore';
import { WorldEvent } from '../types/event';
import { WorldSnapshot } from '../types/world';

export function useWorldEvents() {
  const workforceId = useWorldStore((s) => s.workforceId);
  const authToken = useWorldStore((s) => s.authToken);
  const activeWorkspaceId = useWorldStore((s) => s.activeWorkspace?.id || '');
  const currentUser = useWorldStore((s) => s.currentUser);
  const setSnapshot = useWorldStore((s) => s.setSnapshot);
  const applyWorldEvent = useWorldStore((s) => s.applyWorldEvent);
  const fetchSnapshot = useWorldStore((s) => s.fetchSnapshot);
  const hydrateAuthSession = useWorldStore((s) => s.hydrateAuthSession);
  const clearAuthSession = useWorldStore((s) => s.clearAuthSession);
  const setWsConnected = useEventStore((s) => s.setWsConnected);
  const setErrorBanner = useEventStore((s) => s.setErrorBanner);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authToken) {
      return;
    }
    let cancelled = false;
    const bootstrap = async () => {
      if (!currentUser || !activeWorkspaceId) {
        const ok = await hydrateAuthSession();
        if (!ok || cancelled) return;
      }
      if (!cancelled) {
        await fetchSnapshot();
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [authToken, currentUser, activeWorkspaceId, hydrateAuthSession, fetchSnapshot]);

  useEffect(() => {
    if (!authToken || !workforceId || workforceId === 'wf_forge_default') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    let isMounted = true;

    const connect = () => {
      if (!isMounted || !authToken || !workforceId || workforceId === 'wf_forge_default') return;
      const wsParams = new URLSearchParams({ token: authToken });
      if (activeWorkspaceId) {
        wsParams.set('workspace_id', activeWorkspaceId);
      }
      const wsUrl = `${WS_BASE_URL}/ws/world/${encodeURIComponent(workforceId)}?${wsParams.toString()}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsConnected(true);
      };

      ws.onmessage = (evt) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'INITIAL_SNAPSHOT' && data.snapshot) {
            setSnapshot(data.snapshot as WorldSnapshot);
          } else if (data.type === 'WORLD_EVENT') {
            applyWorldEvent(data as WorldEvent);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = (event) => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (!isMounted) return;
        setWsConnected(false);

        if (event.code === 1008) {
          const reason = (event.reason || '').toLowerCase();
          const isAuthFailure =
            reason.includes('token') ||
            reason.includes('auth') ||
            reason.includes('expired') ||
            reason.includes('revoked') ||
            reason.includes('session') ||
            reason.includes('unauthorized') ||
            reason.includes('401');
          if (isAuthFailure) {
            clearAuthSession(true);
          } else {
            setErrorBanner(event.reason || 'WebSocket connection rejected (1008).');
          }
          return;
        }

        reconnectTimerRef.current = window.setTimeout(connect, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [workforceId, authToken, activeWorkspaceId, setSnapshot, applyWorldEvent, setWsConnected, clearAuthSession, setErrorBanner]);
}
