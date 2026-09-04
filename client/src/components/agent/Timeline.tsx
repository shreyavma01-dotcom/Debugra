export default function Timeline({ events, actions }: { events:any[], actions:any[] }) {
  const merged = [...events, ...actions.map(a=> ({ type: `tool:${a.tool}`, summary: a.summary, timestamp: a.timestamp, status: a.status, step: a.step }))].sort((a,b)=> new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
  if (merged.length===0) return <div className="text-gray-500 text-sm">No events yet — agent will start shortly...</div>;
  const iconFor = (type:string, status?:string)=>{
    if (type.includes('failed')) return '❌';
    if (type.includes('completed') && status==='FAILED') return '⚠️';
    if (type.includes('completed') || type==='agent.completed') return '✓';
    if (type.includes('replanning')) return '↻';
    if (type.includes('patch')) return '🔧';
    if (type.includes('test')) return '🧪';
    if (type.includes('started')) return '▶';
    if (type.includes('verified')||type.includes('VERIFIED')) return '🟢';
    return '•';
  };
  return (
    <div className="space-y-2">
      {merged.map((e,i)=>(
        <div key={i} className="flex gap-3 text-sm">
          <span className="mt-0.5">{iconFor(e.type, e.status)}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-200">{e.summary || e.type}</span>
              {e.step && <span className="text-xs text-gray-500">step {e.step}</span>}
            </div>
            <div className="text-xs text-gray-500">{new Date(e.timestamp).toLocaleTimeString()} · {e.type}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
