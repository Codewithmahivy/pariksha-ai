import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, GraduationCap, FileText, Users, Zap, Sparkles, ShieldCheck } from "lucide-react";
import { IDS } from "@/constants/testIds";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const Stat = ({ icon: Icon, label, value, suffix, accent }) => (
  <div className="admin-card p-5">
    <div className="flex items-center justify-between">
      <p className="overline text-zinc-500">{label}</p>
      <Icon className={`w-4 h-4 ${accent || "text-zinc-400"}`} />
    </div>
    <div className="mt-3 font-heading font-bold text-3xl tracking-tight">{value}<span className="text-sm text-zinc-500 ml-1">{suffix}</span></div>
  </div>
);

const COLORS = ["#22C55E", "#F59E0B", "#EF4444"];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    try {
      const [s, m] = await Promise.all([api.get("/analytics/dashboard"), api.get("/questions/meta")]);
      setStats(s.data); setMeta(m.data);
    } catch (e) { toast.error("Failed to load stats"); }
  };

  useEffect(() => { load(); }, []);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      const { data } = await api.post("/questions/seed-demo", { per_subject: 60 });
      toast.success(`Seeded ${data.inserted} questions`);
      load();
    } catch (e) { toast.error("Seed failed"); } finally { setSeeding(false); }
  };

  const bySubjectData = meta ? Object.entries(meta.by_subject).map(([k, v]) => ({ subject: k, count: v })) : [];
  const byDifficultyData = meta ? Object.entries(meta.by_difficulty).map(([k, v]) => ({ name: k, value: v })) : [];

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="overline text-blue-400">OVERVIEW</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Command Center</h1>
          <p className="text-zinc-400 mt-2 text-sm">Realtime health of the question bank, blueprints and paper forge.</p>
        </div>
        <Button onClick={seedDemo} disabled={seeding} data-testid={IDS.admin.seedDemoBtn} className="bg-blue-600 hover:bg-blue-700 rounded-sm">
          <Sparkles className="w-4 h-4 mr-2"/> {seeding ? "Seeding..." : "Seed 180 Demo Qs"}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Database} label="QUESTIONS IN BANK" value={stats?.questions ?? "-"} accent="text-blue-400" />
        <Stat icon={FileText} label="BLUEPRINTS" value={stats?.blueprints ?? "-"} accent="text-purple-400" />
        <Stat icon={GraduationCap} label="EXAMS SCHEDULED" value={stats?.exams ?? "-"} accent="text-emerald-400" />
        <Stat icon={Users} label="CANDIDATES" value={stats?.candidates ?? "-"} accent="text-amber-400" />
        <Stat icon={ShieldCheck} label="ENCRYPTED PAPERS" value={stats?.papers_generated ?? "-"} accent="text-blue-400" />
        <Stat icon={Zap} label="AVG GEN TIME" value={stats?.avg_generation_ms?.toFixed(1) ?? "0.0"} suffix="ms" accent="text-emerald-400" />
        <Stat icon={FileText} label="SUBMISSIONS" value={stats?.submissions ?? "-"} accent="text-zinc-300" />
        <div className="admin-card p-5 flex flex-col justify-between">
          <p className="overline text-zinc-500">SYSTEM STATUS</p>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-mono text-emerald-400">FORGE.ONLINE</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="admin-card p-6 lg:col-span-2">
          <p className="overline text-zinc-500 mb-4">BANK COMPOSITION BY SUBJECT</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubjectData}>
                <CartesianGrid stroke="#27272A" strokeDasharray="3 3" />
                <XAxis dataKey="subject" stroke="#71717A" fontSize={12} />
                <YAxis stroke="#71717A" fontSize={12} />
                <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 4 }} />
                <Bar dataKey="count" fill="#2563EB" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="admin-card p-6">
          <p className="overline text-zinc-500 mb-4">DIFFICULTY MIX</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byDifficultyData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {byDifficultyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex gap-4 justify-center text-xs font-mono">
            {byDifficultyData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{background: COLORS[i]}} />
                <span className="text-zinc-400">{d.name}</span>
                <span className="text-white">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
