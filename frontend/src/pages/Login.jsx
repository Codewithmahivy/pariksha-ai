import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { IDS } from "@/constants/testIds";
import { Cpu, Lock } from "lucide-react";

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@neetai.com");
  const [password, setPassword] = useState("Admin@123");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.full_name}`);
      nav(u.role === "admin" ? "/admin" : "/candidate", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 noise-bg">
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-white/5 grid-backdrop">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-blue-600 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="font-heading font-bold tracking-tight">NEET<span className="text-blue-500">.AI</span></span>
        </Link>
        <div>
          <p className="overline text-blue-400">EXAM INTEGRITY SYSTEM</p>
          <h1 className="font-heading text-5xl font-extrabold tracking-tight mt-4 leading-tight">
            Sign in to the <br /><span className="text-zinc-500">command center.</span>
          </h1>
          <p className="text-zinc-400 mt-4 text-sm max-w-md">Papers are forged at exam start. Nothing exists in advance. Nothing leaks.</p>
        </div>
        <div className="badge-encrypted px-3 py-1.5 rounded-sm inline-flex items-center gap-2 w-fit">
          <Lock className="w-3 h-3" /> AES-GCM · per-candidate key
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={submit} className="w-full max-w-md space-y-6 admin-card p-8">
          <div>
            <p className="overline text-zinc-500">AUTHENTICATION</p>
            <h2 className="font-heading text-2xl font-bold mt-2">Enter Platform</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} data-testid={IDS.auth.emailInput} className="rounded-sm bg-zinc-900/70 border-zinc-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} data-testid={IDS.auth.passwordInput} className="rounded-sm bg-zinc-900/70 border-zinc-800" />
          </div>
          <Button type="submit" data-testid={IDS.auth.submitBtn} disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 rounded-sm">
            {submitting ? "Signing in..." : "Sign In"}
          </Button>
          <div className="text-center text-sm text-zinc-400">
            Don't have an account? <Link data-testid={IDS.auth.toggleModeBtn} to="/register" className="text-blue-400 hover:text-blue-300">Register</Link>
          </div>
          <div className="text-xs text-zinc-500 pt-4 border-t border-white/5 space-y-1 font-mono">
            <div>admin@neetai.com · Admin@123</div>
            <div>student@neetai.com · Student@123</div>
          </div>
        </form>
      </div>
    </div>
  );
}
