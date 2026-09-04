import { useEffect, useRef, useState } from 'react';

export function useSSE(runId: string | null) {
  const [events, setEvents] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource|null>(null);

  useEffect(()=>{
    if (!runId) return;
    const url = `/api/agent/runs/${runId}/events`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = ()=> setConnected(true);
    es.onmessage = (e)=>{
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'connected') return;
        setEvents(prev=> [...prev, data]);
      } catch {}
    };
    es.onerror = ()=> setConnected(false);
    return ()=> { es.close(); setConnected(false); };
  }, [runId]);

  return { events, connected };
}
