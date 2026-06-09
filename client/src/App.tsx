import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { EntryPoint } from './pages/EntryPoint';
import { ToolA } from './pages/ToolA';
import { ToolB } from './pages/ToolB';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<EntryPoint />} />
        <Route path="/tool-a" element={<ToolA />} />
        <Route path="/tool-b" element={<ToolB />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
