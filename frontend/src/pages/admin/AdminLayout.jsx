import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Database, FileText, GraduationCap, Sparkles, LogOut, Cpu } from "lucide-react";
import { IDS } from "@/constants/testIds";

const nav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, id: IDS.admin.navDashboard },
  { to: "/admin/questions", label: "Question Bank", icon: Database, id: IDS.admin.navQuestions },
  { to: "/admin/blueprints", label: "Blueprints", icon: FileText, id: IDS.admin.navBlueprints },
  { to: "/admin/exams", label: "Exams", icon: GraduationCap, id: IDS.admin.navExams },
  { to: "/admin/ai", label: "AI Generator", icon: Sparkles, id: IDS.admin.navAI },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex noise-bg">
      <aside className="w-64 shrink-0 border-r border-white/5 flex flex-col relative z-10 bg-[#0A0A0B]">
        <div className="p-5 border-b border-white/5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-blue-600 flex items-center justify-center"><Cpu className="w-4 h-4 text-white"/></div>
          <div>
            <div className="font-heading font-bold text-sm tracking-tight">Pariksha<span className="text-blue-500">.AI</span></div>
            <div className="overline text-zinc-500 -mt-0.5">Command</div>
          </div>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end={n.exact} data-testid={n.id}
              className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${isActive ? "bg-blue-600/10 text-blue-300 border border-blue-500/30" : "text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent"}`}>
              <n.icon className="w-4 h-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="text-xs text-zinc-500 mb-2">Signed in as</div>
          <div className="text-sm font-medium mb-3 truncate">{user?.full_name}</div>
          <Button size="sm" variant="outline" onClick={() => { logout(); navigate("/login"); }} data-testid={IDS.admin.logoutBtn} className="w-full border-zinc-800 rounded-sm">
            <LogOut className="w-3 h-3 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
