import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EntryPoint } from './pages/EntryPoint';
import { Login } from './pages/Login';
import { SplashEntry } from './pages/SplashEntry';
import { ToolA } from './pages/ToolA';
import { ToolB } from './pages/ToolB';
import { ToolC } from './pages/ToolC';
import { ToolD } from './pages/ToolD';
import { ToolSelector } from './pages/ToolSelector';
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
        <Route path="/" element={<ToolSelector />} />
        <Route path="/banner" element={<EntryPoint />} />
        <Route path="/splash" element={<SplashEntry />} />
        <Route path="/tool-a" element={<ToolA />} />
        <Route path="/tool-b" element={<ToolB />} />
        <Route path="/tool-c" element={<ToolC />} />
        <Route path="/tool-d" element={<ToolD />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
