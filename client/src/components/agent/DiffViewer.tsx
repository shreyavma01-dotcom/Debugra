export default function DiffViewer({ diff }: { diff: string }) {
  if (!diff) return <div className="text-gray-500 text-sm">No changes yet</div>;
  const lines = diff.split('\n');
  return (
    <pre className="bg-[#0a0f1c] border border-[#1f2937] rounded-lg p-4 overflow-auto text-xs max-h-[400px]">
      {lines.map((line,i)=>{
        let cls = "text-gray-300";
        if (line.startsWith('+') && !line.startsWith('+++')) cls = "text-emerald-400 bg-emerald-900/10";
        else if (line.startsWith('-') && !line.startsWith('---')) cls = "text-red-400 bg-red-900/10";
        else if (line.startsWith('@@')) cls = "text-cyan-400";
        return <div key={i} className={cls}>{line}</div>;
      })}
    </pre>
  );
}
