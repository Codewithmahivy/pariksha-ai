import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, FileText } from "lucide-react";
import { IDS } from "@/constants/testIds";

const EMPTY_SUBJECT = { subject: "Physics", total_questions: 45, chapters: [], numerical_ratio: 0.3, difficulty_distribution: { Easy: 15, Medium: 20, Hard: 10 } };

export default function Blueprints() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("NEET Mock · Balanced");
  const [description, setDescription] = useState("Balanced NEET-level test");
  const [duration, setDuration] = useState(180);
  const [correct, setCorrect] = useState(4);
  const [wrong, setWrong] = useState(-1);
  const [subjects, setSubjects] = useState([
    { ...EMPTY_SUBJECT, subject: "Physics" },
    { ...EMPTY_SUBJECT, subject: "Chemistry" },
    { ...EMPTY_SUBJECT, subject: "Biology", total_questions: 90, difficulty_distribution: { Easy: 30, Medium: 40, Hard: 20 } },
  ]);

  const load = async () => {
    const { data } = await api.get("/blueprints");
    setItems(data.items);
    const m = await api.get("/questions/meta");
    setMeta(m.data);
  };
  useEffect(() => { load(); }, []);

  const updateSubject = (idx, patch) => setSubjects(list => list.map((s,i)=>i===idx? {...s, ...patch}: s));
  const updateDiff = (idx, key, val) => setSubjects(list => list.map((s,i)=>i===idx? {...s, difficulty_distribution: {...s.difficulty_distribution, [key]: Number(val)||0}}: s));

  const save = async () => {
    try {
      const payload = {
        name, description, total_duration_minutes: Number(duration), marks_per_correct: Number(correct), marks_per_wrong: Number(wrong),
        subjects: subjects.map(s => ({
          subject: s.subject,
          total_questions: Number(s.total_questions),
          difficulty_distribution: s.difficulty_distribution,
          chapters: s.chapters || [],
          numerical_ratio: Number(s.numerical_ratio),
        })),
      };
      await api.post("/blueprints", payload);
      toast.success("Blueprint saved");
      setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
  };

  const remove = async (id) => {
    try { await api.delete(`/blueprints/${id}`); toast.success("Deleted"); load(); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="overline text-blue-400">CONFIG</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Exam Blueprints</h1>
          <p className="text-zinc-400 mt-2 text-sm">Define subject weightage, difficulty mix and marking scheme.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid={IDS.admin.createBlueprintBtn} className="bg-blue-600 hover:bg-blue-700 rounded-sm"><Plus className="w-4 h-4 mr-2"/>New Blueprint</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#101014] border-white/10 rounded-sm max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Create Blueprint</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="bp-name-input"/></div>
                <div><Label>Duration (min)</Label><Input type="number" value={duration} onChange={e=>setDuration(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="bp-duration-input"/></div>
                <div><Label>Marks per Correct</Label><Input type="number" value={correct} onChange={e=>setCorrect(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800"/></div>
                <div><Label>Marks per Wrong</Label><Input type="number" value={wrong} onChange={e=>setWrong(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800"/></div>
              </div>
              <div><Label>Description</Label><Textarea value={description} onChange={e=>setDescription(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800"/></div>

              <div className="pt-4 border-t border-white/5">
                <p className="overline text-zinc-500 mb-3">SUBJECT ALLOCATION</p>
                {subjects.map((s, idx) => (
                  <div key={idx} className="admin-card p-4 mb-3">
                    <div className="grid md:grid-cols-4 gap-3 items-end">
                      <div>
                        <Label className="text-xs">Subject</Label>
                        <Select value={s.subject} onValueChange={v=>updateSubject(idx,{subject:v})}>
                          <SelectTrigger className="rounded-sm bg-zinc-900/70 border-zinc-800"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Physics">Physics</SelectItem>
                            <SelectItem value="Chemistry">Chemistry</SelectItem>
                            <SelectItem value="Biology">Biology</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Total Questions</Label><Input type="number" value={s.total_questions} onChange={e=>updateSubject(idx,{total_questions:Number(e.target.value)})} className="rounded-sm bg-zinc-900/70 border-zinc-800"/></div>
                      <div><Label className="text-xs">Numerical Ratio (0-1)</Label><Input type="number" step="0.1" value={s.numerical_ratio} onChange={e=>updateSubject(idx,{numerical_ratio:e.target.value})} className="rounded-sm bg-zinc-900/70 border-zinc-800"/></div>
                      <div className="text-xs font-mono text-zinc-500">Bank: {meta?.by_subject?.[s.subject] || 0}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {["Easy","Medium","Hard"].map(d => (
                        <div key={d}>
                          <Label className="text-xs">{d}</Label>
                          <Input type="number" value={s.difficulty_distribution[d]} onChange={e=>updateDiff(idx,d,e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800"/>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={save} data-testid={IDS.admin.saveBlueprintBtn} className="w-full bg-blue-600 hover:bg-blue-700 rounded-sm">Save Blueprint</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(bp => (
          <div key={bp.id} className="admin-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <FileText className="w-4 h-4 text-blue-400 mb-2" />
                <h3 className="font-heading font-bold text-lg tracking-tight">{bp.name}</h3>
                <p className="text-xs text-zinc-500 mt-1">{bp.description || "—"}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={()=>remove(bp.id)} className="text-red-400 hover:bg-red-500/10" data-testid={`bp-delete-${bp.id}`}>
                <Trash2 className="w-3.5 h-3.5"/>
              </Button>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
              {bp.subjects.map(s => (
                <div key={s.subject} className="flex justify-between text-xs">
                  <span className="text-zinc-400">{s.subject}</span>
                  <span className="font-mono text-white">{s.total_questions} <span className="text-zinc-500">Q · E{s.difficulty_distribution.Easy}/M{s.difficulty_distribution.Medium}/H{s.difficulty_distribution.Hard}</span></span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 text-xs font-mono text-zinc-500">
              {bp.total_duration_minutes}min · +{bp.marks_per_correct} / {bp.marks_per_wrong}
            </div>
          </div>
        ))}
        {items.length===0 && <div className="col-span-full text-center text-zinc-500 py-10 admin-card">No blueprints yet. Click "New Blueprint" to create one.</div>}
      </div>
    </div>
  );
}
