import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadProject, createRun } from '../services/api';

export default function NewRun(){
  const [file,setFile]=useState<File|null>(null);
  const [name,setName]=useState('');
  const [goal,setGoal]=useState('Fix the authentication issue and make all authentication tests pass.');
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const nav=useNavigate();

  const handleStart=async()=>{
    if (!file) { setError('Please select a ZIP file'); return; }
    if (!goal.trim()) { setError('Please enter a debugging goal'); return; }
    setUploading(true); setError('');
    try {
      const proj = await uploadProject(file, name || file.name.replace('.zip',''));
      const run = await createRun(proj.projectId, goal);
      nav(`/runs/${run.runId}`);
    } catch (e:any){
      setError(e.response?.data?.error?.message || e.message);
    } finally { setUploading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">New Debugging Run</h1>
      <p className="text-gray-400">Upload a ZIP, describe the goal, and let Debugra autonomously recover the software.</p>

      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 space-y-5">
        <div>
          <label className="text-sm font-medium">Project ZIP</label>
          <div className="mt-2 border-2 border-dashed border-[#1f2937] rounded-lg p-8 text-center hover:border-blue-500/50 transition">
            <input type="file" accept=".zip" onChange={e=> setFile(e.target.files?.[0]||null)} className="hidden" id="zipInput" />
            <label htmlFor="zipInput" className="cursor-pointer">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-sm text-gray-300">{file? file.name : 'Click to select project.zip'}</div>
              <div className="text-xs text-gray-500 mt-1">Max 50MB · ZIP only</div>
            </label>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Project Name (optional)</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="task-manager" className="mt-2 w-full bg-[#0a0f1c] border border-[#1f2937] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-sm font-medium">Debugging Goal</label>
          <textarea value={goal} onChange={e=>setGoal(e.target.value)} rows={3} placeholder="Fix authentication and make all authentication tests pass" className="mt-2 w-full bg-[#0a0f1c] border border-[#1f2937] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
          <div className="text-xs text-gray-500 mt-1">Example: "Fix the authentication issue and make all authentication tests pass."</div>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm">{error}</div>}
        <button onClick={handleStart} disabled={uploading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold">
          {uploading? 'Uploading & Starting Agent...' : 'Start Autonomous Debugging →'}
        </button>
        <div className="text-xs text-gray-500 text-center">GOAL → OBSERVE → DECIDE → ACT → TEST → EVALUATE → ADAPT → VERIFY</div>
      </div>

      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <div className="font-medium text-sm">Sample project</div>
        <div className="text-xs text-gray-400 mt-1">Use <code className="bg-[#0a0f1c] px-1 py-0.5 rounded">sample-projects/task-manager</code> — intentionally broken with 2 auth bugs. Goal: fix auth to get 12/12 tests passing.</div>
      </div>
    </div>
  );
}
