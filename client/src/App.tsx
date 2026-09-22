import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, setUser, setBooted } from './store';
import api, { getAccess, clearSession } from './services/api';
import { ToastProvider, Spinner } from './components/common';

import PublicLayout from './components/layout/PublicLayout';
import AppLayout from './components/layout/AppLayout';

import Landing from './modules/public/Landing';
import LoginPage from './modules/auth/LoginPage';
import SignupPage from './modules/auth/SignupPage';
import AuthMisc from './modules/auth/AuthMisc';
import Dashboard from './modules/dashboard/Dashboard';
import TemplatesLibrary from './modules/templates/TemplatesLibrary';
import TemplateDetail from './modules/templates/TemplateDetail';
import QuestionnaireFlow from './modules/questionnaire/QuestionnaireFlow';
import MyDocuments from './modules/documents/MyDocuments';
import PaymentPage from './modules/documents/PaymentPage';
import DocumentDetail from './modules/documents/DocumentDetail';
import GuestSigning from './modules/documents/GuestSigning';
import PrintView from './modules/documents/PrintView';
import Favorites from './modules/documents/Favorites';
import AuditLogPage from './modules/audit/AuditLogPage';
import Profile from './modules/profile/Profile';
import AdminDashboard from './modules/admin/AdminDashboard';
import AdminUsers from './modules/admin/AdminUsers';
import AdminEmails from './modules/admin/AdminEmails';
import AdminAudit from './modules/admin/AdminAudit';
import AdminTemplates from './modules/admin/AdminTemplates';
import TemplateStudio from './modules/admin/TemplateStudio';

function RequireAuth({ children, admin = false }: { children: JSX.Element; admin?: boolean }): JSX.Element {
  const { user, booted } = useSelector((s: RootState) => s.auth);
  const location = useLocation();
  if (!booted) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App(): JSX.Element {
  const dispatch = useDispatch();
  useEffect(() => {
    if (!getAccess()) {
      dispatch(setBooted());
      return;
    }
    api.get('/auth/me')
      .then((r) => dispatch(setUser(r.data.user)))
      .catch(() => clearSession())
      .finally(() => dispatch(setBooted()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<AuthMisc view="forgot" />} />
            <Route path="/reset-password" element={<AuthMisc view="reset" />} />
            <Route path="/verify-email" element={<AuthMisc view="verify" />} />
          </Route>

          <Route path="/sign/:token" element={<GuestSigning />} />
          <Route path="/print/:id" element={<PrintView />} />

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/templates" element={<RequireAuth><TemplatesLibrary /></RequireAuth>} />
            <Route path="/template/:id" element={<RequireAuth><TemplateDetail /></RequireAuth>} />
            <Route path="/template/:id/create" element={<RequireAuth><QuestionnaireFlow /></RequireAuth>} />
            <Route path="/documents" element={<RequireAuth><MyDocuments /></RequireAuth>} />
            <Route path="/document/:id" element={<RequireAuth><DocumentDetail /></RequireAuth>} />
            <Route path="/document/:id/payment" element={<RequireAuth><PaymentPage /></RequireAuth>} />
            <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
            <Route path="/audit" element={<RequireAuth><AuditLogPage /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

            <Route path="/admin" element={<RequireAuth admin><AdminDashboard /></RequireAuth>} />
            <Route path="/admin/emails" element={<RequireAuth admin><AdminEmails /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth admin><AdminUsers /></RequireAuth>} />
            <Route path="/admin/audit" element={<RequireAuth admin><AdminAudit /></RequireAuth>} />
            <Route path="/admin/templates" element={<RequireAuth admin><AdminTemplates /></RequireAuth>} />
            <Route path="/admin/templates/:id/edit" element={<RequireAuth admin><TemplateStudio /></RequireAuth>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
