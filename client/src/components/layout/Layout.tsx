import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white flex flex-col">
      <header className="border-b border-[#1f2937] bg-[#111827]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-sm">DP</div>
            <span className="font-bold text-lg tracking-tight">Debugra</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">MVP</span>
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link to="/" className={loc.pathname==='/'?'text-blue-400':'text-gray-400 hover:text-white'}>Dashboard</Link>
            <Link to="/new-run" className={loc.pathname==='/new-run'?'text-blue-400':'text-gray-400 hover:text-white'}>New Run</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">{children}</main>
      <footer className="border-t border-[#1f2937] py-4 text-center text-xs text-gray-500">Autonomous Software Debugging & Recovery Agent — GOAL → OBSERVE → DECIDE → ACT → TEST → EVALUATE → ADAPT → VERIFY</footer>
    </div>
  );
}
