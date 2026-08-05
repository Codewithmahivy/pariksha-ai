import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Radio, Clock, Lock, ChevronRight, CheckCircle2, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { IDS } from "@/constants/testIds";

function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(()=>setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const s = Math.floor(diff/1000);
  return { seconds: s, hh: Math.floor(s/3600), mm: Math.floor((s%3600)/60), ss: s%60, over: diff===0 };
}

const ExamCard = ({ ex, onJoin, onResult, hasResult }) => {
  const c = useCountdown(ex.scheduled_start);
  const isLive = ex.computed_status === "live";
  const isScheduled = ex.computed_status === "scheduled";
  const isEnded = ex.computed_status === "ended";

  return (
    <div className="admin-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isLive && <span className="badge-live px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase inline-flex items-center gap-1"><Radio className="w-3 h-3 timer-warning"/>LIVE NOW</span>}
            {isScheduled && <span className="badge-encrypted px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase inline-flex items-center gap-1"><Lock className="w-3 h-3"/>SEALED · GENERATES AT START</span>}
            {isEnded && <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase border border-zinc-700 text-zinc-400">ENDED</span>}
          </div>
          <h3 className="font-heading font-bold text-xl tracking-tight">{ex.name}</h3>
          <p className="text-sm text-zinc-400 mt-1">{ex.description || "NEET-level assessment"}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2 text-zinc-400"><Clock className="w-3.5 h-3.5"/>{new Date(ex.scheduled_start).toLocaleString()}</div>
        <div className="flex items-center gap-2 text-zinc-400"><Timer className="w-3.5 h-3.5"/>{ex.duration_minutes} min</div>
      </div>
      {isScheduled && (
        <div className="mt-4 admin-card p-3 flex items-center justify-between">
          <span className="overline text-zinc-500">STARTS IN</span>
          <span className="font-mono text-xl text-blue-300">{String(c.hh).padStart(2,"0")}:{String(c.mm).padStart(2,"0")}:{String(c.ss).padStart(2,"0")}</span>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        {isLive && (
          <Button onClick={()=>onJoin(ex)} data-testid={IDS.candidate.joinExamBtn} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm">
            Enter Exam <ChevronRight className="w-4 h-4 ml-1"/>
          </Button>
        )}
        {isScheduled && (
          <Button disabled className="flex-1 rounded-sm cursor-not-allowed">
            <Lock className="w-3.5 h-3.5 mr-2"/>Locked until start
          </Button>
        )}
        {isEnded && hasResult && (
          <Button onClick={()=>onResult(ex)} variant="outline" data-testid={IDS.candidate.viewResultBtn} className="flex-1 border-zinc-800 rounded-sm">
            <CheckCircle2 className="w-4 h-4 mr-2"/> View Result
          </Button>
        )}
        {isEnded && !hasResult && (
          <Button disabled variant="outline" className="flex-1 border-zinc-800 rounded-sm">No submission</Button>
        )}
      </div>
    </div>
  );
};

export default function CandidateDashboard() {
  const [items, setItems] = useState([]);
  const [results, setResults] = useState({});
  const nav = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get("/exams");
      setItems(data.items);
      // Prefetch which exams user has results in
      const rmap = {};
      for (const ex of data.items) {
        if (ex.computed_status === "ended") {
          try { await api.get(`/exams/${ex.id}/result`); rmap[ex.id] = true; } catch {}
        }
      }
      setResults(rmap);
    } catch { toast.error("Failed to load exams"); }
  };
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const join = async (ex) => {
    try {
      const { data } = await api.post(`/exams/${ex.id}/join`);
      toast.success(`Paper forged in ${data.generated_in_ms.toFixed(1)}ms · sealed with AES-GCM`);
      nav(`/exam/${ex.id}`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Cannot join"); }
  };

  const viewResult = (ex) => nav(`/candidate/exams/${ex.id}/result`);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="overline text-blue-400">CANDIDATE PORTAL</p>
        <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Your Exams</h1>
        <p className="text-zinc-400 mt-2 text-sm">Papers do not exist until the moment the exam begins. When you enter, yours will be forged, sealed and delivered in milliseconds.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map(ex => <ExamCard key={ex.id} ex={ex} onJoin={join} onResult={viewResult} hasResult={!!results[ex.id]} />)}
        {items.length===0 && <div className="col-span-full text-center text-zinc-500 py-16 admin-card">No exams scheduled yet.</div>}
      </div>
    </div>
  );
}
