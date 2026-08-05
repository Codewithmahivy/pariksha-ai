import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, MinusCircle, ArrowLeft, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Results() {
  const { examId } = useParams();
  const [r, setR] = useState(null);

  useEffect(() => {
    api.get(`/exams/${examId}/result`).then(res => setR(res.data)).catch(()=>toast.error("Result not found"));
  }, [examId]);

  if (!r) return <div className="p-10 text-center text-zinc-400">Loading...</div>;

  const percentage = r.max_score > 0 ? ((r.score / r.max_score) * 100).toFixed(1) : 0;
  const chartData = Object.entries(r.subject_breakdown || {}).map(([subject, s]) => ({
    subject, Correct: s.correct, Wrong: s.wrong, Unattempted: s.unattempted,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <Link to="/candidate" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm"><ArrowLeft className="w-4 h-4"/> Back to Exams</Link>

      <div className="admin-card p-8 flex items-center justify-between">
        <div>
          <p className="overline text-blue-400">RESULT</p>
          <h1 className="font-heading text-5xl font-bold tracking-tight mt-2">{r.score} <span className="text-zinc-500 text-2xl">/ {r.max_score}</span></h1>
          <p className="text-zinc-400 mt-2 text-sm font-mono">{percentage}% · submitted {new Date(r.submitted_at).toLocaleString()}</p>
        </div>
        <Trophy className="w-16 h-16 text-amber-400" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="admin-card p-5"><div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-400"/><div><p className="overline text-zinc-500">CORRECT</p><div className="font-heading text-3xl font-bold">{r.correct}</div></div></div></div>
        <div className="admin-card p-5"><div className="flex items-center gap-3"><XCircle className="w-5 h-5 text-red-400"/><div><p className="overline text-zinc-500">WRONG</p><div className="font-heading text-3xl font-bold">{r.wrong}</div></div></div></div>
        <div className="admin-card p-5"><div className="flex items-center gap-3"><MinusCircle className="w-5 h-5 text-zinc-500"/><div><p className="overline text-zinc-500">UNATTEMPTED</p><div className="font-heading text-3xl font-bold">{r.unattempted}</div></div></div></div>
      </div>

      <div className="admin-card p-6">
        <p className="overline text-zinc-500 mb-4">SUBJECT-WISE BREAKDOWN</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid stroke="#27272A" strokeDasharray="3 3"/>
              <XAxis dataKey="subject" stroke="#71717A" fontSize={12}/>
              <YAxis stroke="#71717A" fontSize={12}/>
              <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #27272A" }}/>
              <Bar dataKey="Correct" stackId="a" fill="#22C55E"/>
              <Bar dataKey="Wrong" stackId="a" fill="#EF4444"/>
              <Bar dataKey="Unattempted" stackId="a" fill="#3F3F46"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="admin-card p-6">
        <p className="overline text-zinc-500 mb-4">REVIEW · {r.review?.length || 0} QUESTIONS</p>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {r.review?.map((q, i) => {
            const correct = q.selected_key === q.correct_key;
            const unattempted = !q.selected_key;
            return (
              <div key={q.id} className={`admin-card p-4 ${correct ? "border-emerald-500/30" : unattempted ? "" : "border-red-500/30"}`}>
                <div className="flex justify-between items-start mb-2">
                  <p className="overline text-zinc-500">Q{i+1} · {q.subject} · {q.chapter}</p>
                  {correct && <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 rounded-sm">CORRECT</Badge>}
                  {!correct && !unattempted && <Badge variant="outline" className="border-red-500/40 text-red-300 rounded-sm">WRONG</Badge>}
                  {unattempted && <Badge variant="outline" className="border-zinc-700 text-zinc-400 rounded-sm">SKIPPED</Badge>}
                </div>
                <p className="text-sm mb-3">{q.text}</p>
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map(o => {
                    const isCorrect = o.key === q.correct_key;
                    const isSel = o.key === q.selected_key;
                    let cls = "border-zinc-800 bg-zinc-900/40 text-zinc-300";
                    if (isCorrect) cls = "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
                    else if (isSel) cls = "border-red-500/50 bg-red-500/10 text-red-200";
                    return <div key={o.key} className={`px-3 py-2 text-xs rounded-sm border ${cls}`}><span className="font-mono mr-2">{o.key}.</span>{o.text}</div>;
                  })}
                </div>
                {q.explanation && <p className="text-xs text-zinc-500 mt-3 leading-relaxed">💡 {q.explanation}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
