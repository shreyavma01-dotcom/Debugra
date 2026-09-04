const request = require('supertest');
const app = require('../server/index');

describe('Tasks', () => {
  test('health check', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('login and list tasks', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'password' });
    expect(login.status).toBe(200);
    const res = await request(app).get('/api/tasks').set('Authorization', login.body.token);
    // This will fail due to secret mismatch if token was generated with different secret than verified
    // After first fix (secret alignment), this should pass for raw token but Bearer tests still fail
    expect(res.status).toBe(200);
  });

  test('create task validation', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'password' });
    const token = login.body.token;
    const res = await request(app).post('/api/tasks').set('Authorization', token).send({});
    expect(res.status).toBe(400);
  });

  test('tasks are isolated', async () => {
    const login = await request(app).post('/api/login').send({ username: 'admin', password: 'password' });
    const token = login.body.token;
    const before = await request(app).get('/api/tasks').set('authorization', token);
    // lowercase header test — will fail until second bug fixed
    expect(before.status).toBe(200);
  });
});
