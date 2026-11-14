import { useEffect, useRef } from 'react';
import { WS_BASE_URL } from '../config';
import { useEventStore } from '../state/eventStore';
import { useWorldStore } from '../state/worldStore';
import { WorldEvent } from '../types/event';
import { WorldSnapshot } from '../types/world';

export function useWorldEvents() {
  const workforceId = useWorldStore((s) => s.workforceId);
  const setSnapshot = useWorldStore((s) => s.setSnapshot);
  const applyWorldEvent = useWorldStore((s) => s.applyWorldEvent);
  const fetchSnapshot = useWorldStore((s) => s.fetchSnapshot);
  const setWsConnected = useEventStore((s) => s.setWsConnected);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      const targetId = workforceId || 'current';
      const wsUrl = `${WS_BASE_URL}/ws/world/${encodeURIComponent(targetId)}`;

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

      ws.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
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
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [workforceId, setSnapshot, applyWorldEvent, setWsConnected]);
}
