import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminExamsPage } from './pages/admin/AdminExamsPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminMonitoringPage } from './pages/admin/AdminMonitoringPage';
import { AdminParticipantsPage } from './pages/admin/AdminParticipantsPage';
import { AdminQuestionsPage } from './pages/admin/AdminQuestionsPage';
import { AdminResultsPage } from './pages/admin/AdminResultsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminSupabasePage } from './pages/admin/AdminSupabasePage';
import { ExamResultPage } from './pages/student/ExamResultPage';
import { ExamRoomPage } from './pages/student/ExamRoomPage';
import { StudentLoginPage } from './pages/student/StudentLoginPage';
import { applyThemeClass, useThemeStore } from './store/themeStore';

export default function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<StudentLoginPage />} />
        <Route path="/ujian/ruang" element={<ExamRoomPage />} />
        <Route path="/ujian/selesai" element={<ExamResultPage />} />

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="pengaturan" element={<AdminSettingsPage />} />
          <Route path="peserta" element={<AdminParticipantsPage />} />
          <Route path="ujian" element={<AdminExamsPage />} />
          <Route path="soal" element={<AdminQuestionsPage />} />
          <Route path="monitoring" element={<AdminMonitoringPage />} />
          <Route path="nilai" element={<AdminResultsPage />} />
          <Route path="supabase" element={<AdminSupabasePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
