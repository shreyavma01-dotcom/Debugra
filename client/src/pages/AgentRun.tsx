import { useParams } from 'react-router-dom';
import { useAgentRun } from '../hooks/useAgentRun';
import { useSSE } from '../hooks/useSSE';
import StatusBadge from '../components/common/StatusBadge';
import Timeline from '../components/agent/Timeline';
import DiffViewer from '../components/agent/DiffViewer';
import { useEffect, useState } from 'react';
import { getDiff, stopRun, retryRun } from '../services/api';

export default function AgentRun(){
  const { id } = useParams();
  const { run, actions } = useAgentRun(id||null);
  const { events } = useSSE(id||null);
  const [diff,setDiff]=useState('');
  const [showDiff,setShowDiff]=useState(false);

  useEffect(()=>{
    if (run && ['VERIFIED','FAILED','STOPPED'].includes(run.status)) {
      getDiff(run.runId).then(d=> setDiff(d.diff)).catch(()=>{});
    }
  },[run?.status]);

  const handleDownload=()=>{
    if (!id) return;
    window.open(`/api/agent/runs/${id}/download`,'_blank');
  };

  if (!run) return <div className="text-center py-20 text-gray-400">Loading run...</div>;

  const baseline = run.baselineResult;
  const final = run.finalResult;
  const isDone = ['VERIFIED','FAILED','STOPPED','TIMEOUT'].includes(run.status);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Agent Run</h1>
            <StatusBadge status={run.status}/>
          </div>
          <div className="text-sm text-gray-400 mt-1 font-mono text-xs">{run.runId}</div>
        </div>
        <div className="flex gap-2">
          {!isDone && <button onClick={()=> stopRun(run.runId)} className="px-4 py-2 bg-red-600/20 border border-red-500/30 text-red-300 rounded-lg text-sm">Stop</button>}
          {isDone && <button onClick={async()=>{ const r=await retryRun(run.runId); window.location.href=`/runs/${r.runId}`; }} className="px-4 py-2 bg-[#1f2937] border border-[#374151] rounded-lg text-sm">Retry</button>}
          <button onClick={handleDownload} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">Download Patched ZIP</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[#111827] border border-[#1f2937] rounded-xl p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Goal</div>
          <div className="mt-2 text-sm bg-[#0a0f1c] border border-[#1f2937] rounded-lg p-3">{run.goal}</div>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-gray-400">Steps</span><span className="font-mono">{run.stepCount}/{run.maxSteps}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Attempts</span><span>{run.attempts}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Replans</span><span>{run.replans}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-400">Duration</span><span>{run.completedAt? Math.round((new Date(run.completedAt).getTime()-new Date(run.startedAt).getTime())/1000)+'s':'running'}</span></div>
          {baseline && <div className="flex justify-between text-sm"><span className="text-gray-400">Baseline</span><span className={baseline.failed>0?'text-red-300':'text-emerald-300'}>{baseline.passed}/{baseline.total}</span></div>}
          {final && <div className="flex justify-between text-sm"><span className="text-gray-400">Final</span><span className={final.failed===0?'text-emerald-300':'text-yellow-300'}>{final.passed}/{final.total}</span></div>}
        </div>
      </div>

      {final && baseline && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
          <div className="font-semibold">Final Result</div>
          <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
            <div><div className="text-gray-500">Baseline</div><div className="text-xl font-bold">{baseline.passed}/{baseline.total}</div></div>
            <div><div className="text-gray-500">Final</div><div className="text-xl font-bold text-emerald-400">{final.passed}/{final.total}</div></div>
            <div><div className="text-gray-500">Files Changed</div><div className="text-xl font-bold">{run.changedFiles?.length||0}</div></div>
            <div><div className="text-gray-500">Verification</div><div className={`text-lg font-bold ${run.status==='VERIFIED'?'text-emerald-400':'text-red-400'}`}>{run.status==='VERIFIED'?'PASS':'FAIL'}</div></div>
          </div>
          {run.error && <div className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 p-3 rounded-lg">{run.error}</div>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
            <div className="font-semibold mb-4">Agent Timeline</div>
            <Timeline events={events} actions={actions}/>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold">Diff & Changed Files</div>
              <button onClick={()=>{
                if (!showDiff && !diff) getDiff(run.runId).then(d=>setDiff(d.diff));
                setShowDiff(!showDiff);
              }} className="text-xs px-3 py-1 bg-[#1f2937] rounded-lg">{showDiff?'Hide':'View Diff'}</button>
            </div>
            {run.changedFiles?.length>0 && <div className="flex flex-wrap gap-2 mb-3">{run.changedFiles.map((f:string)=> <span key={f} className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">{f}</span>)}</div>}
            {showDiff ? <DiffViewer diff={diff}/> : <div className="text-xs text-gray-500">Click View Diff to inspect changes. Download ZIP to get patched project.</div>}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
            <div className="font-semibold text-sm">Test Results</div>
            <div className="mt-3 space-y-2 text-sm">
              {baseline && <div className="flex justify-between bg-[#0a0f1c] p-2 rounded"><span>Baseline</span><span>{baseline.passed}/{baseline.total} {baseline.failed>0?'⚠️': '✓'}</span></div>}
              {final && baseline!==final && <div className="flex justify-between bg-[#0a0f1c] p-2 rounded"><span>Final</span><span>{final.passed}/{final.total} {final.failed===0?'🟢':'🔴'}</span></div>}
              {!baseline && <div className="text-gray-500 text-xs">Awaiting test data...</div>}
              {final?.stdout && <details className="text-xs"><summary className="cursor-pointer text-gray-400">stdout</summary><pre className="mt-2 whitespace-pre-wrap break-words bg-[#0a0f1c] p-2 rounded max-h-40 overflow-auto">{final.stdout.slice(0,3000)}</pre></details>}
            </div>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
            <div className="font-semibold text-sm">Actions ({actions.length})</div>
            <div className="mt-3 space-y-2 max-h-80 overflow-auto">
              {actions.map((a:any,i:number)=>(
                <div key={i} className="text-xs border border-[#1f2937] rounded p-2">
                  <div className="flex justify-between"><span className="font-mono text-blue-300">{a.tool}</span><span className={`${a.status==='SUCCESS'?'text-emerald-300':'text-red-300'}`}>{a.status}</span></div>
                  <div className="text-gray-400 mt-1">{a.summary}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
