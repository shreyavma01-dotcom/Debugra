import { useEffect, useState } from 'react';
import { getRun, getActions } from '../services/api';

export function useAgentRun(runId: string | null) {
  const [run, setRun] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);

  useEffect(()=>{
    if (!runId) return;
    let interval: any;
    const fetch = async ()=>{
      try {
        const r = await getRun(runId);
        setRun(r);
        const a = await getActions(runId);
        setActions(a);
        if (['VERIFIED','FAILED','STOPPED','TIMEOUT'].includes(r.status)) clearInterval(interval);
      } catch {}
    };
    fetch();
    interval = setInterval(fetch, 2000);
    return ()=> clearInterval(interval);
  }, [runId]);

  return { run, actions, refresh: async()=> {
    if (!runId) return;
    setRun(await getRun(runId));
    setActions(await getActions(runId));
  }};
}
