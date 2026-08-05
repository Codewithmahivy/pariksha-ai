import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import QuestionBank from "@/pages/admin/QuestionBank";
import Blueprints from "@/pages/admin/Blueprints";
import Exams from "@/pages/admin/Exams";
import ExamMonitor from "@/pages/admin/ExamMonitor";
import AIGenerate from "@/pages/admin/AIGenerate";
import CandidateLayout from "@/pages/candidate/CandidateLayout";
import CandidateDashboard from "@/pages/candidate/CandidateDashboard";
import ExamRoom from "@/pages/candidate/ExamRoom";
import Results from "@/pages/candidate/Results";

function RequireAuth({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/candidate"} replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" theme="dark" richColors closeButton />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/admin" element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}>
            <Route index element={<AdminDashboard />} />
            <Route path="questions" element={<QuestionBank />} />
            <Route path="blueprints" element={<Blueprints />} />
            <Route path="exams" element={<Exams />} />
            <Route path="exams/:examId/monitor" element={<ExamMonitor />} />
            <Route path="ai" element={<AIGenerate />} />
          </Route>

          <Route path="/candidate" element={<RequireAuth role="candidate"><CandidateLayout /></RequireAuth>}>
            <Route index element={<CandidateDashboard />} />
            <Route path="exams/:examId/result" element={<Results />} />
          </Route>
          <Route path="/exam/:examId" element={<RequireAuth role="candidate"><ExamRoom /></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
