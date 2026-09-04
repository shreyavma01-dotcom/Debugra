const request = require('supertest');
const app = require('../server/index');
const { generateToken } = require('../server/auth');

describe('Authentication', () => {
  test('login returns token', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('login with wrong password fails', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('access tasks without token fails', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  test('access tasks with valid token succeeds', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'password' });
    const token = login.body.token;
    const res = await request(app).get('/api/tasks').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('access tasks with Bearer token succeeds', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'password' });
    const token = login.body.token;
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    // This test expects Bearer handling — will fail with current middleware that doesn't strip Bearer
    // After fix, should pass
    expect(res.status).toBe(200);
  });

  test('access tasks with lowercase authorization header succeeds', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'password' });
    const token = login.body.token;
    const res = await request(app).get('/api/tasks').set('authorization', token);
    expect(res.status).toBe(200);
  });

  test('create task with valid token', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'password' });
    const token = login.body.token;
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'New Task' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Task');
  });

  test('health endpoint works without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
