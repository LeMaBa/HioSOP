import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";
import Layout from "./components/Layout";
import LibraryPage from "./pages/LibraryPage";
import SOPDetailPage from "./pages/SOPDetailPage";
import AdminPage from "./pages/AdminPage";
import UsersPage from "./pages/UsersPage";
import ChangelogPage from "./pages/ChangelogPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<LibraryPage />} />
        <Route path="sop/:id" element={<SOPDetailPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="changelog" element={<ChangelogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
