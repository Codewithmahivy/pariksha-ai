import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Radio, Activity, Clock, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { IDS } from "@/constants/testIds";

const statusColor = { scheduled: "border-zinc-700 text-zinc-300", live: "border-emerald-500/50 text-emerald-300 bg-emerald-500/10", ended: "border-zinc-700 text-zinc-500" };

function toLocalIsoInput(d) {
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Exams() {
  const [items, setItems] = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bp, setBp] = useState("");
  const [startAt, setStartAt] = useState(toLocalIsoInput(new Date(Date.now()+2*60*1000)));
  const [duration, setDuration] = useState(180);
  const [description, setDescription] = useState("");

  const load = async () => {
    const [e, b] = await Promise.all([api.get("/exams"), api.get("/blueprints")]);
    setItems(e.data.items);
    setBlueprints(b.data.items);
    // Use functional setter so we don't reset a user-picked blueprint on the 5s poll (stale-closure fix)
    setBp((current) => current || b.data.items[0]?.id || "");
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const save = async () => {
    if (!bp) { toast.error("Please pick a blueprint first"); return; }
    if (!name.trim()) { toast.error("Exam name is required"); return; }
    try {
      const iso = new Date(startAt).toISOString();
      await api.post("/exams", { name, blueprint_id: bp, scheduled_start: iso, duration_minutes: Number(duration), description });
      toast.success("Exam scheduled"); setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
  };
  const remove = async (id) => { try { await api.delete(`/exams/${id}`); toast.success("Deleted"); load(); } catch { toast.error("Delete failed"); } };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="overline text-blue-400">SCHEDULING</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Exams</h1>
          <p className="text-zinc-400 mt-2 text-sm">Schedule an exam. Papers only forge when the clock strikes start.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid={IDS.admin.createExamBtn} className="bg-blue-600 hover:bg-blue-700 rounded-sm"><Plus className="w-4 h-4 mr-2"/>Schedule Exam</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#101014] border-white/10 rounded-sm max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">Schedule Exam</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="exam-name-input" placeholder="NEET Mock 001"/></div>
              <div>
                <Label>Blueprint</Label>
                {blueprints.length === 0 ? (
                  <div data-testid="exam-no-blueprint-warning" className="rounded-sm border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
                    <div className="flex-1">
                      <p>No blueprints exist yet. You need at least one blueprint before scheduling an exam.</p>
                      <Link to="/admin/blueprints" onClick={()=>setOpen(false)} className="underline text-amber-200 hover:text-white font-mono text-[11px] mt-1 inline-block">→ Create a blueprint</Link>
                    </div>
                  </div>
                ) : (
                  <Select value={bp} onValueChange={setBp}>
                    <SelectTrigger className="rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="exam-bp-select"><SelectValue placeholder="Select blueprint"/></SelectTrigger>
                    <SelectContent>{blueprints.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div><Label>Scheduled Start</Label><Input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="exam-start-input"/></div>
              <div><Label>Duration (min)</Label><Input type="number" value={duration} onChange={e=>setDuration(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800"/></div>
              <div><Label>Description</Label><Textarea value={description} onChange={e=>setDescription(e.target.value)} className="rounded-sm bg-zinc-900/70 border-zinc-800"/></div>
              <Button onClick={save} disabled={!bp || blueprints.length===0} data-testid={IDS.admin.saveExamBtn} className="w-full bg-blue-600 hover:bg-blue-700 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed">Save Exam</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map(ex => (
          <div key={ex.id} className="admin-card p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded-sm border ${statusColor[ex.computed_status]}`}>
                    {ex.computed_status === "live" && <Radio className="w-3 h-3 inline mr-1 timer-warning"/>}
                    {ex.computed_status}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-lg tracking-tight">{ex.name}</h3>
                <p className="text-xs text-zinc-500 mt-1">{ex.description}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={()=>remove(ex.id)} className="text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5"/>
              </Button>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 space-y-1.5 text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-2"><Clock className="w-3 h-3"/> {new Date(ex.scheduled_start).toLocaleString()}</div>
              <div className="flex items-center gap-2"><Activity className="w-3 h-3"/> {ex.duration_minutes} min</div>
            </div>
            <div className="mt-4">
              <Link to={`/admin/exams/${ex.id}/monitor`}>
                <Button size="sm" variant="outline" className="w-full border-zinc-800 rounded-sm hover:bg-white/5" data-testid={IDS.admin.monitorBtn}>
                  <Radio className="w-3.5 h-3.5 mr-2"/> Live Monitor
                </Button>
              </Link>
            </div>
          </div>
        ))}
        {items.length===0 && <div className="col-span-full text-center text-zinc-500 py-10 admin-card">No exams. Schedule one to unleash the paper forge.</div>}
      </div>
    </div>
  );
}
