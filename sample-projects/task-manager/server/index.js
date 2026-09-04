const express = require('express');
const { generateToken } = require('./auth');
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(express.json());

// Simple in-memory user
const USER = { id: 1, username: 'admin', password: 'password' };
let tasks = [
  { id: 1, title: 'Task 1', owner: 1 },
  { id: 2, title: 'Task 2', owner: 1 }
];

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === USER.username && password === USER.password) {
    const token = generateToken({ id: USER.id, username: USER.username });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/tasks', authMiddleware, (req, res) => {
  res.json(tasks);
});

app.post('/api/tasks', authMiddleware, (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const task = { id: tasks.length + 1, title, owner: req.user.id };
  tasks.push(task);
  res.status(201).json(task);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

if (require.main === module) {
  const port = process.env.PORT || 4001;
  app.listen(port, () => console.log('Task manager listening on ' + port));
}

module.exports = app;
