import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export async function uploadProject(file: File, name: string) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('name', name);
  const { data } = await api.post('/projects/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data.data;
}
export async function createRun(projectId: string, goal: string) {
  const { data } = await api.post('/agent/runs', { projectId, goal });
  return data.data;
}
export async function getRun(id: string) { const { data } = await api.get(`/agent/runs/${id}`); return data.data; }
export async function getRuns() { const { data } = await api.get('/agent/runs'); return data.data; }
export async function getActions(id: string) { const { data } = await api.get(`/agent/runs/${id}/actions`); return data.data; }
export async function getDiff(id: string) { const { data } = await api.get(`/agent/runs/${id}/diff`); return data.data; }
export async function stopRun(id: string) { const { data } = await api.post(`/agent/runs/${id}/stop`); return data.data; }
export async function retryRun(id: string) { const { data } = await api.post(`/agent/runs/${id}/retry`); return data.data; }
export async function health() { const { data } = await api.get('/health'); return data.data; }
export default api;
