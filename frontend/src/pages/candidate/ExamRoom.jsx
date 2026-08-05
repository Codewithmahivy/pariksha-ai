import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, ChevronLeft, ChevronRight, Flag, ShieldCheck, Send, Lock, AlertOctagon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { IDS } from "@/constants/testIds";

function fmtTime(sec) {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

export default function ExamRoom() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [meta, setMeta] = useState(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState(null);
  const [riskScore, setRiskScore] = useState(0);

  // ---------- Live proctor signals ----------
  const lastEventTimeRef = useRef(0);
  const switchWindowRef = useRef([]);
  const [alertMsg, setAlertMsg] = useState(null);

  const sendProctorEvent = async (event_type, detail = "") => {
    // Throttle: skip duplicates within 800ms
    const now = Date.now();
    if (now - lastEventTimeRef.current < 800) return;
    lastEventTimeRef.current = now;
    try {
      const { data } = await api.post(`/exams/${examId}/proctor-events`, { event_type, detail });
      if (typeof data?.risk_score === "number") setRiskScore(data.risk_score);
      if (data?.auto_paused) {
        setPaused(true);
        setPauseReason("auto:high_risk");
        toast.error("Your paper has been paused by the proctor.");
      }
    } catch { /* silent */ }
    setAlertMsg(`⚠ Signal logged · ${event_type.replace("_", " ")}`);
    setTimeout(() => setAlertMsg(null), 2200);
  };

  useEffect(() => {
    if (!meta || submittedRef.current) return;
    const onVis = () => { if (document.hidden) { sendProctorEvent("tab_hidden"); trackRapidSwitch(); } };
    const onBlur = () => sendProctorEvent("window_blur");
    const onPaste = (e) => { e.preventDefault(); sendProctorEvent("paste_attempt"); };
    const onCopy = (e) => { e.preventDefault(); sendProctorEvent("copy_attempt"); };
    const onContext = (e) => { e.preventDefault(); sendProctorEvent("context_menu"); };
    const onFsChange = () => { if (!document.fullscreenElement && wasFullscreenRef.current) sendProctorEvent("fullscreen_exit"); };
    const trackRapidSwitch = () => {
      const now = Date.now();
      switchWindowRef.current = [...switchWindowRef.current.filter(t => now - t < 20000), now];
      if (switchWindowRef.current.length >= 3) {
        sendProctorEvent("rapid_switch", `${switchWindowRef.current.length} switches in 20s`);
        switchWindowRef.current = [];
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste);
    document.addEventListener("copy", onCopy);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
    // eslint-disable-next-line
  }, [meta, examId]);

  const wasFullscreenRef = useRef(false);
  const enterFullscreen = async () => {
    try { await document.documentElement.requestFullscreen(); wasFullscreenRef.current = true; }
    catch { /* user cancelled */ }
  };
  // ---------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const join = await api.post(`/exams/${examId}/join`);
        toast.success(`Paper generated in ${join.data.generated_in_ms.toFixed(1)}ms · sealed`);
        setMeta(join.data);
        const startedAt = new Date(join.data.exam.scheduled_start).getTime();
        const endsAt = startedAt + join.data.duration_minutes * 60 * 1000;
        setRemaining(Math.max(0, Math.floor((endsAt - Date.now())/1000)));
        const paper = await api.get(`/exams/${examId}/paper`);
        setQuestions(paper.data.questions);
        setPaused(!!paper.data.paused);
        setPauseReason(paper.data.pause_reason);
        if (paper.data.submitted) {
          toast.info("You've already submitted this paper");
          nav(`/candidate/exams/${examId}/result`);
        }
      } catch (e) { toast.error(e?.response?.data?.detail || "Unable to load paper"); nav("/candidate"); }
      finally { setLoading(false); }
    })();
  }, [examId, nav]);

  // Poll paper state (pause release / re-pause by admin) every 4s
  useEffect(() => {
    if (!meta || submittedRef.current) return;
    const iv = setInterval(async () => {
      try {
        const { data } = await api.get(`/exams/${examId}/paper`);
        setPaused(!!data.paused);
        setPauseReason(data.pause_reason);
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(iv);
  }, [meta, examId]);

  useEffect(() => {
    if (remaining <= 0 || !meta) return;
    if (paused) return;  // Freeze timer while paused
    const i = setInterval(() => {
      setRemaining(r => {
        if (r <= 1 && !submittedRef.current) {
          submittedRef.current = true;
          submit();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line
  }, [meta, paused]);

  const timerColor = remaining < 300 ? "text-red-400 timer-warning" : remaining < 900 ? "text-amber-300" : "text-emerald-300";

  const q = questions[idx];
  const totalAnswered = Object.values(answers).filter(v=>v).length;
  const totalMarked = Object.values(markedForReview).filter(v=>v).length;

  const select = (key) => setAnswers(a => ({ ...a, [q.id]: key }));
  const toggleMark = () => setMarkedForReview(m => ({ ...m, [q.id]: !m[q.id] }));
  const clear = () => setAnswers(a => ({ ...a, [q.id]: null }));

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = { answers: questions.map(qq => ({ question_id: qq.id, selected_key: answers[qq.id] || null })) };
      await api.post(`/exams/${examId}/submit`, payload);
      toast.success("Submitted · encrypted paper resealed & graded");
      nav(`/candidate/exams/${examId}/result`);
    } catch (e) { toast.error(e?.response?.data?.detail || "Submit failed"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center exam-light"><div className="text-slate-600">Forging your paper...</div></div>;
  if (!q) return null;

  return (
    <div className="exam-light min-h-screen">
      {/* Pause overlay - blocks everything until proctor releases */}
      {paused && (
        <div data-testid="paper-paused-overlay" className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded border border-red-300 shadow-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertOctagon className="w-8 h-8 text-red-600"/>
            </div>
            <div className="text-xs uppercase tracking-widest text-red-600 font-semibold mb-2">Paper Paused By Proctor</div>
            <h2 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">Your exam has been temporarily locked.</h2>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {pauseReason === "auto:high_risk"
                ? `Suspicious activity was detected (risk score ${riskScore}). Your invigilator has been notified.`
                : "A proctor has paused your paper. Please raise your hand and wait for further instructions."}
            </p>
            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-mono text-slate-500">
              <Lock className="w-3 h-3"/> Timer frozen · answers preserved · paper still sealed
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-blue-600 flex items-center justify-center"><ShieldCheck className="w-4 h-4 text-white"/></div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Encrypted Paper</div>
            <div className="text-xs text-slate-400 font-mono">gen · {meta?.generated_in_ms?.toFixed(1)}ms · sealed</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={enterFullscreen} data-testid="candidate-fullscreen-btn" className="rounded-sm border-slate-300 text-slate-700 hidden md:inline-flex">
            Fullscreen
          </Button>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Time Remaining</div>
            <div className={`font-mono text-2xl font-bold ${timerColor}`}><Clock className="w-4 h-4 inline mr-1 -mt-1"/>{fmtTime(remaining)}</div>
          </div>
          <Button onClick={()=>setConfirmSubmit(true)} data-testid={IDS.candidate.submitExamBtn} className="bg-blue-600 hover:bg-blue-700 rounded-sm text-white">
            <Send className="w-4 h-4 mr-2"/>Submit
          </Button>
        </div>
      </header>

      {alertMsg && (
        <div data-testid="proctor-alert-banner" className="sticky top-[65px] z-20 bg-amber-50 border-b border-amber-200 px-6 py-2 text-center text-sm font-mono text-amber-800">
          {alertMsg} — action logged for proctor review
        </div>
      )}

      <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-6 p-6 lg:p-10">
        {/* Question center */}
        <section className="lg:col-span-8 bg-white rounded border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Question {idx+1} <span className="text-slate-300">/ {questions.length}</span></div>
              <div className="mt-1 flex gap-2">
                <Badge variant="outline" className="rounded-sm border-blue-200 text-blue-700 bg-blue-50">{q.subject}</Badge>
                <Badge variant="outline" className="rounded-sm border-slate-200 text-slate-600">{q.chapter}</Badge>
                <Badge variant="outline" className="rounded-sm border-slate-200 text-slate-600">{q.difficulty}</Badge>
                <Badge variant="outline" className="rounded-sm border-slate-200 text-slate-600">{q.q_type}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleMark} className={`rounded-sm ${markedForReview[q.id] ? "bg-purple-50 border-purple-300 text-purple-700" : "border-slate-200 text-slate-600"}`}>
              <Flag className="w-3.5 h-3.5 mr-2"/>{markedForReview[q.id] ? "Marked" : "Mark for review"}
            </Button>
          </div>

          <p className="question-body mb-8">{q.text}</p>

          <div className="space-y-3">
            {q.options.map(o => {
              const sel = answers[q.id] === o.key;
              return (
                <button key={o.key} onClick={()=>select(o.key)} data-testid={`${IDS.candidate.optionBtn}-${o.key}`}
                  className={`w-full text-left px-5 py-4 border rounded transition-colors flex items-start gap-4 ${sel ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"}`}>
                  <span className={`shrink-0 w-8 h-8 rounded-full border font-mono font-semibold flex items-center justify-center ${sel ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-300"}`}>{o.key}</span>
                  <span className="text-slate-900 text-base leading-relaxed">{o.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
            <Button variant="outline" onClick={()=>setIdx(i=>Math.max(0,i-1))} disabled={idx===0} className="rounded-sm border-slate-300"><ChevronLeft className="w-4 h-4 mr-1"/>Previous</Button>
            <Button variant="ghost" onClick={clear} className="text-slate-500 hover:text-slate-700">Clear response</Button>
            <Button onClick={()=>setIdx(i=>Math.min(questions.length-1,i+1))} disabled={idx===questions.length-1} className="rounded-sm bg-slate-900 hover:bg-slate-800 text-white">Next<ChevronRight className="w-4 h-4 ml-1"/></Button>
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded border border-slate-200 p-5 shadow-sm">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">Question Palette</div>
            <div className="grid grid-cols-6 gap-1.5">
              {questions.map((qq, i) => {
                const ans = !!answers[qq.id];
                const mark = !!markedForReview[qq.id];
                const cur = i === idx;
                let cls = "bg-slate-100 text-slate-500 border-slate-200";
                if (mark && ans) cls = "bg-purple-500 text-white border-purple-500";
                else if (mark) cls = "bg-purple-100 text-purple-700 border-purple-300";
                else if (ans) cls = "bg-emerald-500 text-white border-emerald-500";
                if (cur) cls += " ring-2 ring-blue-500 ring-offset-1";
                return (
                  <button key={qq.id} onClick={()=>setIdx(i)} data-testid={`${IDS.candidate.questionNavBtn}-${i+1}`}
                    className={`h-8 text-xs font-mono border rounded-sm transition ${cls}`}>{i+1}</button>
                );
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between"><span>Answered</span><span className="font-mono text-emerald-600">{totalAnswered}</span></div>
              <div className="flex justify-between"><span>Marked for review</span><span className="font-mono text-purple-600">{totalMarked}</span></div>
              <div className="flex justify-between"><span>Unanswered</span><span className="font-mono text-slate-500">{questions.length - totalAnswered}</span></div>
            </div>
          </div>

          <div className="bg-white rounded border border-slate-200 p-5 shadow-sm">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Legend</div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2"><span className="w-4 h-4 bg-emerald-500 rounded-sm"/> Answered</div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 bg-purple-100 border border-purple-300 rounded-sm"/> Marked</div>
              <div className="flex items-center gap-2"><span className="w-4 h-4 bg-slate-100 border border-slate-200 rounded-sm"/> Not visited / answered</div>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent className="bg-white border-slate-200 rounded max-w-md">
          <DialogHeader><DialogTitle className="text-slate-900">Submit exam?</DialogTitle></DialogHeader>
          <div className="text-sm text-slate-600 space-y-2">
            <p>You will lock in <b>{totalAnswered}</b> answers across {questions.length} questions.</p>
            <p><b>{questions.length - totalAnswered}</b> question(s) will remain unanswered.</p>
            <p className="text-xs text-slate-500 pt-3 border-t border-slate-100">Once submitted, your paper is graded and the encryption seal is finalized.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setConfirmSubmit(false)} className="rounded-sm">Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 rounded-sm text-white">{submitting ? "Submitting..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
