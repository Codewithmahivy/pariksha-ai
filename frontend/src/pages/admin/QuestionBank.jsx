import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const diffColor = { Easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", Medium: "bg-amber-500/15 text-amber-300 border-amber-500/40", Hard: "bg-red-500/15 text-red-300 border-red-500/40" };

export default function QuestionBank() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ subject: "all", difficulty: "all", q_type: "all", search: "" });
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState(null);
  const limit = 50;

  const load = async () => {
    const params = { limit, skip: page * limit };
    if (filters.subject !== "all") params.subject = filters.subject;
    if (filters.difficulty !== "all") params.difficulty = filters.difficulty;
    if (filters.q_type !== "all") params.q_type = filters.q_type;
    if (filters.search) params.search = filters.search;
    const { data } = await api.get("/questions", { params });
    setItems(data.items); setTotal(data.total);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters, page]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <p className="overline text-blue-400">CATALOG</p>
        <h1 className="font-heading text-4xl font-bold tracking-tight mt-2">Question Bank</h1>
        <p className="text-zinc-400 mt-2 text-sm">Browse and filter the master bank of NEET-level questions.</p>
      </div>

      <div className="admin-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input placeholder="Search question text..." value={filters.search} onChange={e=>{setPage(0);setFilters(f=>({...f,search:e.target.value}));}} className="pl-9 rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="qb-search-input" />
        </div>
        <Select value={filters.subject} onValueChange={v=>{setPage(0);setFilters(f=>({...f,subject:v}));}}>
          <SelectTrigger className="w-40 rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="qb-subject-filter"><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            <SelectItem value="Physics">Physics</SelectItem>
            <SelectItem value="Chemistry">Chemistry</SelectItem>
            <SelectItem value="Biology">Biology</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.difficulty} onValueChange={v=>{setPage(0);setFilters(f=>({...f,difficulty:v}));}}>
          <SelectTrigger className="w-36 rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="qb-difficulty-filter"><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.q_type} onValueChange={v=>{setPage(0);setFilters(f=>({...f,q_type:v}));}}>
          <SelectTrigger className="w-36 rounded-sm bg-zinc-900/70 border-zinc-800" data-testid="qb-type-filter"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Numerical">Numerical</SelectItem>
            <SelectItem value="Theoretical">Theoretical</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs font-mono text-zinc-500 ml-auto">TOTAL · {total}</div>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-zinc-400 overline w-24">SUBJECT</TableHead>
              <TableHead className="text-zinc-400 overline">CHAPTER</TableHead>
              <TableHead className="text-zinc-400 overline">QUESTION</TableHead>
              <TableHead className="text-zinc-400 overline w-24">DIFFICULTY</TableHead>
              <TableHead className="text-zinc-400 overline w-24">TYPE</TableHead>
              <TableHead className="text-zinc-400 overline w-16">SOURCE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(q => (
              <TableRow key={q.id} className="border-white/5 cursor-pointer hover:bg-white/5" onClick={()=>setPreview(q)} data-testid={`qb-row-${q.id}`}>
                <TableCell className="text-blue-300 font-mono text-xs">{q.subject}</TableCell>
                <TableCell className="text-zinc-300 text-sm">{q.chapter}</TableCell>
                <TableCell className="text-sm max-w-lg truncate">{q.text}</TableCell>
                <TableCell><Badge className={`rounded-sm border ${diffColor[q.difficulty]}`} variant="outline">{q.difficulty}</Badge></TableCell>
                <TableCell className="text-xs font-mono text-zinc-400">{q.q_type}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-sm border-zinc-700 text-zinc-400 uppercase text-[10px]">{q.source}</Badge></TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-zinc-500 py-10">No questions match the filter. Try seeding the demo bank.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-xs font-mono text-zinc-500">Page {page + 1} of {Math.max(1, Math.ceil(total / limit))}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-sm border-zinc-800" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page === 0} data-testid="qb-prev-page">Prev</Button>
          <Button variant="outline" size="sm" className="rounded-sm border-zinc-800" onClick={()=>setPage(p=>p+1)} disabled={(page+1)*limit >= total} data-testid="qb-next-page">Next</Button>
        </div>
      </div>

      <Dialog open={!!preview} onOpenChange={o=>!o && setPreview(null)}>
        <DialogContent className="bg-[#101014] border-white/10 rounded-sm max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading">Question Preview</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="rounded-sm border-blue-500/40 text-blue-300">{preview.subject}</Badge>
                <Badge variant="outline" className="rounded-sm border-zinc-700 text-zinc-300">{preview.chapter}</Badge>
                <Badge className={`rounded-sm border ${diffColor[preview.difficulty]}`} variant="outline">{preview.difficulty}</Badge>
                <Badge variant="outline" className="rounded-sm border-zinc-700 text-zinc-300">{preview.q_type}</Badge>
              </div>
              <p className="text-base leading-relaxed">{preview.text}</p>
              <div className="space-y-2">
                {preview.options?.map(o => (
                  <div key={o.key} className={`px-3 py-2 rounded-sm border text-sm ${o.key===preview.correct_key ? "border-emerald-500/50 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900/40"}`}>
                    <span className="font-mono text-xs mr-2">{o.key}.</span>{o.text}
                    {o.key===preview.correct_key && <span className="ml-2 text-emerald-400 text-xs font-mono">✓ CORRECT</span>}
                  </div>
                ))}
              </div>
              {preview.explanation && (
                <div className="pt-3 border-t border-white/5">
                  <p className="overline text-zinc-500 mb-1">EXPLANATION</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{preview.explanation}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
