export default function StatusBadge({ status }: { status: string }) {
  const map: any = {
    VERIFIED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    FAILED: 'bg-red-500/20 text-red-300 border-red-500/30',
    RUNNING: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    EXECUTING: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    ANALYZING: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    TESTING: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    REPLANNING: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    VERIFYING: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  };
  const isRunning = ['CREATED','INITIALIZING','ANALYZING','PLANNING','EXECUTING','TESTING','EVALUATING','REPLANNING','VERIFYING'].includes(status);
  const label = isRunning ? 'RUNNING' : status;
  const cls = map[status] || map[label] || 'bg-gray-700 text-gray-300 border-gray-600';
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>{label}</span>;
}
