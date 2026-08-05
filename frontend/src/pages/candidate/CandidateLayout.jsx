import React from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Cpu } from "lucide-react";

export default function CandidateLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-screen noise-bg">
      <header className="relative z-10 border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link to="/candidate" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-blue-600 flex items-center justify-center"><Cpu className="w-4 h-4 text-white"/></div>
          <span className="font-heading font-bold tracking-tight">NEET<span className="text-blue-500">.AI</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">{user?.full_name}</div>
            <div className="text-xs text-zinc-500 font-mono">CANDIDATE</div>
          </div>
          <Button variant="outline" size="sm" onClick={()=>{logout(); nav("/login");}} className="border-zinc-800 rounded-sm">
            <LogOut className="w-3.5 h-3.5 mr-2"/> Sign Out
          </Button>
        </div>
      </header>
      <main className="relative z-10">
        <Outlet/>
      </main>
    </div>
  );
}
