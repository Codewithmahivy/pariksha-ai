import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { IDS } from "@/constants/testIds";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [sp] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(sp.get("role") === "admin" ? "admin" : "candidate");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await register({ email, password, full_name: fullName, role });
      toast.success("Account created");
      nav(u.role === "admin" ? "/admin" : "/candidate", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 noise-bg">
      <form onSubmit={submit} className="w-full max-w-md admin-card p-8 space-y-5">
        <div>
          <p className="overline text-zinc-500">CREATE ACCOUNT</p>
          <h2 className="font-heading text-2xl font-bold mt-2">Register</h2>
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name</Label>
          <Input id="full_name" required value={fullName} onChange={(e)=>setFullName(e.target.value)} data-testid={IDS.auth.fullNameInput} className="rounded-sm bg-zinc-900/70 border-zinc-800" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} data-testid={IDS.auth.emailInput} className="rounded-sm bg-zinc-900/70 border-zinc-800" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password (min 6 chars)</Label>
          <Input id="password" type="password" minLength={6} required value={password} onChange={(e)=>setPassword(e.target.value)} data-testid={IDS.auth.passwordInput} className="rounded-sm bg-zinc-900/70 border-zinc-800" />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger data-testid={IDS.auth.roleSelect} className="rounded-sm bg-zinc-900/70 border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="candidate">Candidate</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy} data-testid={IDS.auth.submitBtn} className="w-full bg-blue-600 hover:bg-blue-700 rounded-sm">
          {busy ? "Creating..." : "Create Account"}
        </Button>
        <div className="text-center text-sm text-zinc-400">
          Already have an account? <Link data-testid={IDS.auth.toggleModeBtn} to="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
        </div>
      </form>
    </div>
  );
}
