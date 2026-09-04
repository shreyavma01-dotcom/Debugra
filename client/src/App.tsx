import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import NewRun from './pages/NewRun';
import AgentRun from './pages/AgentRun';
import NotFound from './pages/NotFound';

export default function App(){
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard/>} />
          <Route path="/new-run" element={<NewRun/>} />
          <Route path="/runs/:id" element={<AgentRun/>} />
          <Route path="*" element={<NotFound/>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
