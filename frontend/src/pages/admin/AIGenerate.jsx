import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Cpu, Loader2 } from "lucide-react";
import { IDS } from "@/constants/testIds";

export default function AIGenerate() {
  const [subject, setSubject] = useState("Physics");
  const [chapter, setChapter] = useState("Kinematics");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [qType, setQType] = useState("Theoretical");
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState([]);
  const [meta, setMeta] = useState(null);

  useEffect(() => { api.get("/questions/meta").then(r=>setMeta(r.data)); }, []);

  const generate = async () => {
    setBusy(true); setGenerated([]);
    try {
      const { data } = await api.post("/questions/generate-ai", { subject, chapter, topic, difficulty, q_type: qType, count: Number(count) });
      setGenerated(data.items);
      toast.success(`Generated ${data.generated} questions in ${data.elapsed_ms.toFixed(0)}ms`);
    } catch (e) { toast.error(e?.response?.data?.detail || "AI generation failed"); }
    finally { setBusy(false); }
  };

  const chapters = meta?.chapters?.[subject] || [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <p className="overline text-blue-400">GENERATOR</p>
        <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">AI Question Forge</h1>
        <p className="text-zinc-400 mt-2 text-sm">Gemini 3 Flash generates NEET-level MCQs on demand and drops them straight into the bank.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="admin-card p-6 lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-blue-500/10 border border-blue-500/40 flex items-center justify-center"><Cpu className="w-4 h-4 text-blue-400"/></div>
            <div>
              <p className="overline text-zinc-500">MODEL</p>
              <div className="font-mono text-sm">gemini-3-flash-preview</div>
            </div>
          </div>

          <div><Label>Subject</Label>
            <Select value={subject} onValueChange={v=>{setSubject(v); setChapter(meta?.chapters?.[v]?.[0]||"");}}>
              <SelectTrigger className="rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="ai-subject-select"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="Physics">Physics</SelectItem>
                <SelectItem value="Chemistry">Chemistry</SelectItem>
                <SelectItem value="Biology">Biology</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div><Label>Chapter</Label>
            <Select value={chapter} onValueChange={setChapter}>
              <SelectTrigger className="rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="ai-chapter-select"><SelectValue/></SelectTrigger>
              <SelectContent className="max-h-72">{chapters.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>Topic (optional)</Label>
            <Input value={topic} onChange={e=>setTopic(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800" placeholder="e.g. Newton's third law"/></div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="rounded-sm bg-zinc-900/70 border-zinc-800"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Type</Label>
              <Select value={qType} onValueChange={setQType}>
                <SelectTrigger className="rounded-sm bg-zinc-900/70 border-zinc-800"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Theoretical">Theoretical</SelectItem>
                  <SelectItem value="Numerical">Numerical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div><Label>Count (1-15)</Label>
            <Input type="number" min={1} max={15} value={count} onChange={e=>setCount(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="ai-count-input"/></div>

          <Button onClick={generate} disabled={busy} data-testid={IDS.admin.aiGenerateBtn} className="w-full bg-blue-600 hover:bg-blue-700 rounded-sm">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Generating...</> : <><Sparkles className="w-4 h-4 mr-2"/>Generate</>}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {busy && (
            <div className="admin-card p-10 text-center">
              <div className="inline-flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin"/>
                <p className="overline text-zinc-500">CONSULTING GEMINI 3 FLASH...</p>
              </div>
            </div>
          )}
          {!busy && generated.length === 0 && (
            <div className="admin-card p-10 text-center text-zinc-500">
              <Sparkles className="w-8 h-8 mx-auto text-zinc-600 mb-3"/>
              <p className="text-sm">Configure the panel on the left and hit Generate. New questions are auto-saved to the bank.</p>
            </div>
          )}
          {generated.map((q, i) => (
            <div key={q.id} className="admin-card p-5">
              <div className="flex justify-between items-start mb-3">
                <p className="overline text-zinc-500">Q{i+1} · {q.subject} · {q.chapter}</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="rounded-sm border-blue-500/40 text-blue-300">{q.difficulty}</Badge>
                  <Badge variant="outline" className="rounded-sm border-zinc-700 text-zinc-300">{q.q_type}</Badge>
                  <Badge variant="outline" className="rounded-sm border-purple-500/40 text-purple-300">AI</Badge>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-3">{q.text}</p>
              <div className="grid grid-cols-2 gap-2">
                {q.options?.map(o => (
                  <div key={o.key} className={`px-3 py-2 text-xs rounded-sm border ${o.key===q.correct_key ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-zinc-800 bg-zinc-900/40"}`}>
                    <span className="font-mono mr-2">{o.key}.</span>{o.text}
                  </div>
                ))}
              </div>
              {q.explanation && <p className="text-xs text-zinc-500 mt-3 leading-relaxed">💡 {q.explanation}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
