import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRuns, health } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';

export default function Dashboard(){
  const [runs,setRuns]=useState<any[]>([]);
  const [h,setH]=useState<any>(null);
  useEffect(()=>{
    getRuns().then(setRuns).catch(()=>{});
    health().then(setH).catch(()=>{});
    const id=setInterval(()=> getRuns().then(setRuns).catch(()=>{}),3000);
    return ()=> clearInterval(id);
  },[]);
  const successRate = runs.length ? Math.round(runs.filter(r=>r.status==='VERIFIED').length/runs.length*100) : 0;
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">Autonomous debugging runs · GOAL → VERIFY</p>
        </div>
        <Link to="/new-run" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">+ New Run</Link>
      </div>

      {h && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <div className="text-xs text-gray-500">Total Runs</div>
            <div className="text-2xl font-bold mt-1">{runs.length}</div>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <div className="text-xs text-gray-500">Success Rate</div>
            <div className="text-2xl font-bold mt-1 text-emerald-400">{successRate}%</div>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <div className="text-xs text-gray-500">Verified</div>
            <div className="text-2xl font-bold mt-1 text-emerald-400">{runs.filter(r=>r.status==='VERIFIED').length}</div>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <div className="text-xs text-gray-500">Gemini</div>
            <div className="text-sm mt-1">{h.geminiConfigured? '🟢 Configured':'🟡 Heuristic fallback'}</div>
            <div className="text-xs text-gray-500">{h.sandboxMode} sandbox</div>
          </div>
        </div>
      )}

      <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#1f2937] font-semibold">Recent Runs</div>
        {runs.length===0? <div className="p-12 text-center text-gray-500">No runs yet. <Link to="/new-run" className="text-blue-400">Create your first run</Link></div> :
        <table className="w-full text-sm">
          <thead className="text-gray-500 bg-[#0a0f1c]/50">
            <tr><th className="text-left p-3">Goal</th><th>Status</th><th>Steps</th><th>Attempts</th><th>Started</th><th></th></tr>
          </thead>
          <tbody>
            {runs.map(r=>(
              <tr key={r.runId} className="border-t border-[#1f2937] hover:bg-[#1f2937]/30">
                <td className="p-3 max-w-[320px] truncate">{r.goal}</td>
                <td className="p-3"><StatusBadge status={r.status}/></td>
                <td className="p-3 text-center">{r.stepCount}/{r.maxSteps}</td>
                <td className="p-3 text-center">{r.attempts}</td>
                <td className="p-3 text-xs text-gray-400">{new Date(r.startedAt).toLocaleString()}</td>
                <td className="p-3"><Link to={`/runs/${r.runId}`} className="text-blue-400 hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>}
      </div>
    </div>
  );
}
