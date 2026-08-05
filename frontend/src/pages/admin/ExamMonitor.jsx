import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Radio, ShieldCheck, Zap, Users, AlertTriangle, Eye, Clipboard, MousePointer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

const Stat = ({ label, value, suffix, accent = "text-white" }) => (
  <div className="admin-card p-5">
    <p className="overline text-zinc-500">{label}</p>
    <div className={`mt-3 font-heading font-bold text-3xl tracking-tight ${accent}`}>{value}<span className="text-sm text-zinc-500 ml-1">{suffix}</span></div>
  </div>
);

const EVENT_LABEL = {
  tab_hidden: { label: "Tab hidden", icon: Eye, color: "text-amber-300" },
  window_blur: { label: "Window blur", icon: Eye, color: "text-amber-300" },
  paste_attempt: { label: "Paste attempt", icon: Clipboard, color: "text-red-300" },
  copy_attempt: { label: "Copy attempt", icon: Clipboard, color: "text-amber-300" },
  context_menu: { label: "Right-click", icon: MousePointer, color: "text-zinc-400" },
  fullscreen_exit: { label: "Fullscreen exit", icon: AlertTriangle, color: "text-red-300" },
  rapid_switch: { label: "Rapid switching", icon: AlertTriangle, color: "text-red-300" },
};

const riskColor = {
  HIGH: "border-red-500/50 text-red-300 bg-red-500/10",
  MEDIUM: "border-amber-500/50 text-amber-300 bg-amber-500/10",
  LOW: "border-emerald-500/50 text-emerald-300 bg-emerald-500/10",
};

export default function ExamMonitor() {
  const { examId } = useParams();
  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [proctor, setProctor] = useState({ events: [], risk_by_candidate: [] });

  const load = async () => {
    try {
      const [m, l, p] = await Promise.all([
        api.get(`/exams/${examId}/monitor`),
        api.get(`/exams/${examId}/leaderboard`),
        api.get(`/exams/${examId}/proctor-events?limit=50`),
      ]);
      setData(m.data); setLeaderboard(l.data.items); setProctor(p.data);
      setHistory(h => [...h.slice(-19), { t: new Date().toLocaleTimeString().split(" ")[0], papers: m.data.papers_generated, submitted: m.data.submitted }]);
    } catch (e) { toast.error("Load failed"); }
  };
  useEffect(() => { load(); const i = setInterval(load, 3000); return () => clearInterval(i); }, [examId]);

  const togglePause = async (candidateId, pause) => {
    try {
      const path = pause ? "pause" : "unpause";
      await api.post(`/exams/${examId}/candidates/${candidateId}/${path}`);
      toast.success(pause ? "Candidate paused" : "Candidate unpaused");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Action failed"); }
  };

  const recentDist = (data?.recent_papers || []).slice(0, 10).map((p, i) => ({ i: i+1, ms: Number((p.generated_in_ms || 0).toFixed(2)) }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/exams" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-2"><ArrowLeft className="w-4 h-4"/> Back to Exams</Link>
          <p className="overline text-blue-400">LIVE</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Paper Forge Monitor</h1>
          <p className="text-zinc-400 mt-2 text-sm font-mono">exam.id · {examId}</p>
        </div>
        <div className="badge-encrypted px-3 py-1.5 rounded-sm text-xs inline-flex items-center gap-2">
          <Radio className="w-3 h-3 timer-warning"/> STREAMING · 3s
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="PAPERS FORGED" value={data?.papers_generated ?? "-"} accent="text-blue-300" />
        <Stat label="SUBMITTED" value={data?.submitted ?? "-"} accent="text-emerald-300" />
        <Stat label="AVG GEN" value={(data?.avg_generation_ms || 0).toFixed(1)} suffix="ms" accent="text-white"/>
        <Stat label="P0/P100 RANGE" value={`${(data?.min_generation_ms||0).toFixed(1)} - ${(data?.max_generation_ms||0).toFixed(1)}`} suffix="ms" accent="text-zinc-300"/>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="admin-card p-6">
          <p className="overline text-zinc-500 mb-4">CANDIDATE JOIN VELOCITY</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid stroke="#27272A" strokeDasharray="3 3" />
                <XAxis dataKey="t" stroke="#71717A" fontSize={11} />
                <YAxis stroke="#71717A" fontSize={11} />
                <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A" }} />
                <Line type="monotone" dataKey="papers" stroke="#2563EB" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="submitted" stroke="#22C55E" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="admin-card p-6">
          <p className="overline text-zinc-500 mb-4">LAST 10 PAPERS · GEN TIME (ms)</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentDist}>
                <CartesianGrid stroke="#27272A" strokeDasharray="3 3" />
                <XAxis dataKey="i" stroke="#71717A" fontSize={11}/>
                <YAxis stroke="#71717A" fontSize={11}/>
                <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A" }} />
                <Bar dataKey="ms" fill="#22C55E" radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="admin-card p-6">
          <p className="overline text-zinc-500 mb-4">RECENT PAPERS · ENCRYPTED</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(data?.recent_papers || []).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-blue-400"/>
                  <div>
                    <div className="font-medium">{p.candidate?.full_name || p.candidate_id.slice(0,8)}</div>
                    <div className="font-mono text-[10px] text-zinc-500">{p.id.slice(0,12)}...</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-emerald-400"><Zap className="w-3 h-3 inline mr-1"/>{p.generated_in_ms?.toFixed(1)}ms</div>
                  <div className="font-mono text-[10px] text-zinc-500">{p.submitted ? "SUBMITTED" : "SEALED"}</div>
                </div>
              </div>
            ))}
            {(data?.recent_papers||[]).length===0 && <div className="text-center text-zinc-500 py-8 text-sm">No candidates have joined yet.</div>}
          </div>
        </div>
        <div className="admin-card p-6">
          <p className="overline text-zinc-500 mb-4">LEADERBOARD · <Users className="w-3 h-3 inline"/></p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {leaderboard.map((r, i) => {
              const riskRow = proctor.risk_by_candidate.find(x => x.candidate_id === r.candidate_id);
              return (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-white/5 text-sm">
                <div className={`font-mono text-xs w-6 ${i===0?"text-amber-400":i===1?"text-zinc-300":i===2?"text-orange-400":"text-zinc-500"}`}>#{i+1}</div>
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">{r.candidate?.full_name}
                    {riskRow && <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm border ${riskColor[riskRow.risk_level]}`}>{riskRow.risk_level}</span>}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500">{r.candidate?.email}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-white">{r.score}<span className="text-zinc-500 text-xs">/{r.max_score}</span></div>
                  <div className="font-mono text-[10px] text-emerald-400">{r.correct}✓ · {r.wrong}✗</div>
                </div>
              </div>
            );})}
            {leaderboard.length===0 && <div className="text-center text-zinc-500 py-8 text-sm">No submissions yet.</div>}
          </div>
        </div>
      </div>

      {/* Live Cheat Signals */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="admin-card p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="overline text-red-400 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5"/>LIVE CHEAT SIGNALS · FEED</p>
            <span className="text-xs font-mono text-zinc-500">{proctor.events.length} events</span>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto" data-testid="proctor-events-feed">
            {proctor.events.map(ev => {
              const meta = EVENT_LABEL[ev.event_type] || { label: ev.event_type, icon: AlertTriangle, color: "text-zinc-400" };
              const Icon = meta.icon;
              return (
                <div key={ev.id} className="flex items-center gap-3 py-2 px-2 border-b border-white/5 text-sm hover:bg-white/5">
                  <Icon className={`w-4 h-4 ${meta.color}`}/>
                  <div className="flex-1">
                    <div className="text-zinc-200">{meta.label} <span className="text-zinc-500 font-mono text-xs">· +{ev.weight}</span></div>
                    <div className="font-mono text-[10px] text-zinc-500">{ev.candidate?.full_name || ev.candidate_id.slice(0,8)}</div>
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500 shrink-0">{new Date(ev.created_at).toLocaleTimeString()}</div>
                </div>
              );
            })}
            {proctor.events.length === 0 && <div className="text-center text-zinc-500 py-10 text-sm">No suspicious behaviour detected. All candidates focused.</div>}
          </div>
        </div>

        <div className="admin-card p-6">
          <p className="overline text-zinc-500 mb-4 flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5"/>RISK RANKING · PER CANDIDATE</p>
          <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="proctor-risk-table">
            {proctor.risk_by_candidate.map(row => (
              <div key={row.candidate_id} className="flex items-center gap-3 py-2 border-b border-white/5 text-sm">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {row.candidate?.full_name || row.candidate_id.slice(0,8)}
                    {row.paused && <span data-testid="risk-row-paused-badge" className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm border border-red-500/50 text-red-300 bg-red-500/10">PAUSED</span>}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500">{row.count} events · last {new Date(row.last_event_at).toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg text-white">{row.score}</div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border ${riskColor[row.risk_level]}`}>{row.risk_level}</span>
                </div>
                {!row.submitted && (
                  row.paused ? (
                    <Button size="sm" onClick={()=>togglePause(row.candidate_id, false)} data-testid={`unpause-btn-${row.candidate_id}`} className="rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
                      Unpause
                    </Button>
                  ) : (
                    <Button size="sm" onClick={()=>togglePause(row.candidate_id, true)} data-testid={`pause-btn-${row.candidate_id}`} variant="outline" className="rounded-sm border-red-500/40 text-red-300 hover:bg-red-500/10 h-7 text-xs">
                      Pause
                    </Button>
                  )
                )}
              </div>
            ))}
            {proctor.risk_by_candidate.length === 0 && <div className="text-center text-zinc-500 py-10 text-sm">No risk events yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
