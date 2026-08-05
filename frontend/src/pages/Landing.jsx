import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Zap, Brain, Cpu, ChevronRight, GraduationCap, Sparkles } from "lucide-react";
import { IDS } from "@/constants/testIds";

const Feature = ({ icon: Icon, title, desc }) => (
  <div className="admin-card p-6">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 flex items-center justify-center rounded-sm bg-blue-500/10 border border-blue-500/30">
        <Icon className="w-4 h-4 text-blue-400" />
      </div>
      <p className="overline text-zinc-400">{title}</p>
    </div>
    <p className="text-sm text-zinc-300 leading-relaxed">{desc}</p>
  </div>
);

export default function Landing() {
  return (
    <div className="min-h-screen relative overflow-x-hidden noise-bg">
      <div className="absolute inset-0 grid-backdrop opacity-40 pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-blue-600 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">Pariksha<span className="text-blue-500">.AI</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" data-testid={IDS.landing.candidateLoginBtn} className="text-zinc-300 hover:text-white">
              Sign In
            </Button>
          </Link>
          <Link to="/register">
            <Button data-testid={IDS.landing.heroCta} className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm">
              Get Started <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-8 pb-16 grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-2 mb-6">
            <span className="badge-encrypted px-2.5 py-1 rounded-sm">
              <Lock className="w-3 h-3 inline mr-1.5 -mt-0.5" /> AES-256 · ZERO-KNOWLEDGE PAPERS
            </span>
          </div>
          <h1 className="font-heading font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-7xl leading-[1.02]">
            No paper exists <br />
            <span className="text-zinc-500">until the</span> <span className="text-blue-500">bell rings.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-zinc-400 text-base md:text-lg leading-relaxed">
            An AI question-generation engine that assembles a unique, encrypted NEET-level paper
            for every candidate at the exact instant an exam begins — engineered to make paper leaks
            <span className="text-white"> structurally impossible</span>.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/register?role=admin">
              <Button size="lg" data-testid={IDS.landing.adminLoginBtn} className="bg-white text-black hover:bg-zinc-200 rounded-sm font-medium">
                Enter Command Center <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/register?role=candidate">
              <Button size="lg" variant="outline" data-testid={IDS.landing.candidateLoginBtn} className="border-zinc-700 text-zinc-200 hover:bg-zinc-900 rounded-sm">
                Join as Candidate
              </Button>
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-3 gap-6">
            <div>
              <div className="font-mono text-3xl text-white">10⁶+</div>
              <p className="overline text-zinc-500 mt-1">Question Bank</p>
            </div>
            <div>
              <div className="font-mono text-3xl text-white">&lt;120ms</div>
              <p className="overline text-zinc-500 mt-1">Paper Gen p95</p>
            </div>
            <div>
              <div className="font-mono text-3xl text-white">0</div>
              <p className="overline text-zinc-500 mt-1">Pre-existing Papers</p>
            </div>
          </div>
        </div>

        {/* Diagram-style panel */}
        <div className="lg:col-span-5">
          <div className="admin-card p-6 relative overflow-hidden">
            <p className="overline text-zinc-500 mb-4">LIVE PAPER FORGE · SEQUENCE</p>
            {[
              { t: "T-0.000s", label: "Candidate joins exam", color: "bg-zinc-700" },
              { t: "T+0.008s", label: "Blueprint parsed · fairness matrix built", color: "bg-blue-500" },
              { t: "T+0.041s", label: "$sample from 1.2M question bank", color: "bg-blue-500" },
              { t: "T+0.083s", label: "Option shuffle · candidate-seeded RNG", color: "bg-purple-500" },
              { t: "T+0.104s", label: "AES-GCM encrypt with per-user key", color: "bg-emerald-500" },
              { t: "T+0.117s", label: "Paper delivered · plaintext never persisted", color: "bg-emerald-500" },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-b-0">
                <div className={`w-1.5 h-6 ${row.color}`} />
                <span className="font-mono text-xs text-zinc-500 w-16">{row.t}</span>
                <span className="text-sm text-zinc-200 flex-1">{row.label}</span>
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <span className="badge-live px-2.5 py-1 text-xs rounded-sm font-mono">STATE: ENCRYPTED · SEALED</span>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-12 py-10 border-t border-white/5">
        <p className="overline text-zinc-500 mb-8">CORE CAPABILITIES</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Feature icon={Brain} title="AI BLUEPRINT ANALYZER" desc="Parses subject weightage, chapter distribution, difficulty mix and previous-year trends before every exam." />
          <Feature icon={Zap} title="INSTANT PAPER FORGE" desc="Assembles a unique paper per candidate in milliseconds at exam start. Zero pre-existing papers." />
          <Feature icon={Shield} title="AES-GCM ENCRYPTION" desc="Every paper is sealed with a per-candidate derived key. Plaintext never leaves the vault." />
          <Feature icon={Sparkles} title="FAIRNESS ENGINE" desc="Balances numerical vs theoretical, syllabus coverage & difficulty parity across every candidate." />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 md:px-12 py-24">
        <div className="admin-card p-10 md:p-14 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <p className="overline text-blue-400 mb-3">READY WHEN YOU ARE</p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">Sign in and watch the paper form in real time.</h2>
            <p className="text-zinc-400 mt-3 text-sm">Try the demo — admin@neetai.com / Admin@123 or student@neetai.com / Student@123</p>
          </div>
          <Link to="/login">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 rounded-sm text-white font-medium">
              <GraduationCap className="w-4 h-4 mr-2" /> Enter Platform
            </Button>
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-6 md:px-12 py-6 flex justify-between text-xs text-zinc-500">
        <span>© Pariksha.AI · An Exam Integrity System</span>
        <span className="font-mono">v0.1.0 · sealed -- made by love by Mahi Singh</span>
      </footer>
    </div>
  );
}
