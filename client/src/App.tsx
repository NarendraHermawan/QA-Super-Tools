import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EntryPoint } from './pages/EntryPoint';
import { Login } from './pages/Login';
import { ToolA } from './pages/ToolA';
import { ToolB } from './pages/ToolB';
import { useAuthStore } from './store/useAuthStore';

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<EntryPoint />} />
        <Route path="/tool-a" element={<ToolA />} />
        <Route path="/tool-b" element={<ToolB />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
