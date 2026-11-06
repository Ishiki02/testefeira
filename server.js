const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function createApp(options = {}) {
  const secret = options.secret || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('Defina JWT_SECRET com pelo menos 32 caracteres.');
  }
  const jwtSecret = secret || crypto.randomBytes(32).toString('hex');
  const dbPath = options.dbPath || process.env.DATABASE_PATH || path.join(__dirname, 'ecorotas.db');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password_hash TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, author_email TEXT NOT NULL, author_name TEXT, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
  for (const [table, column] of [['users', 'name'], ['posts', 'author_name']]) {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
  }
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : false }));
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde alguns minutos.' } });
  const cleanName = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const validName = name => name.length >= 2 && name.length <= 80 && !name.includes('@');
  const cleanEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
  const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validPassword = p => typeof p === 'string' && p.length >= 8 && Buffer.byteLength(p, 'utf8') <= 72;
  const publicUser = user => ({ id: user.id, name: validName(cleanName(user.name)) ? cleanName(user.name) : null, email: user.email });
  const session = user => ({ token: jwt.sign({ sub: String(user.id), email: user.email }, jwtSecret, { expiresIn: '7d' }), user: publicUser(user) });
  function requireAuth(req, res, next) {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      // Compatibilidade com tokens antigos emitidos pelo servidor Render.
      req.user = claims.sub ? db.prepare('SELECT * FROM users WHERE id = ?').get(claims.sub) : db.prepare('SELECT * FROM users WHERE email = ?').get(claims.email);
      if (!req.user) throw new Error('Conta indisponível');
      next();
    } catch { res.status(401).json({ error: 'Sessão expirada. Entre novamente.' }); }
  }
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.post('/api/register', authLimiter, async (req, res) => {
    const name = cleanName(req.body?.name), email = cleanEmail(req.body?.email), password = req.body?.password;
    if (!validName(name) || !validEmail(email) || !validPassword(password)) return res.status(400).json({ error: 'Informe nome de 2 a 80 caracteres, e-mail válido e senha com pelo menos 8 caracteres (até 72 bytes).' });
    if (db.prepare('SELECT id FROM users WHERE lower(trim(email)) = ?').get(email)) return res.status(409).json({ error: 'E-mail já cadastrado.' });
    const hash = await bcrypt.hash(password, 10);
    try {
      const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, hash);
      res.status(201).json(session({ id: info.lastInsertRowid, name, email }));
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'E-mail já cadastrado.' });
      throw err;
    }
  });
  app.post('/api/login', authLimiter, async (req, res) => {
    const email = cleanEmail(req.body?.email), password = req.body?.password;
    if (!validEmail(email) || typeof password !== 'string' || Buffer.byteLength(password) > 72) return res.status(400).json({ error: 'Informe e-mail e senha válidos.' });
    const user = db.prepare('SELECT * FROM users WHERE lower(trim(email)) = ? ORDER BY id LIMIT 1').get(email);
    // Hash fixo evita resposta imediata para e-mails inexistentes.
    const hash = user?.password_hash || '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const match = await bcrypt.compare(password, hash);
    if (!user || !match) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    res.json(session(user));
  });
  app.get('/api/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
  app.patch('/api/me', requireAuth, (req, res) => {
    const name = cleanName(req.body?.name);
    if (!validName(name)) return res.status(400).json({ error: 'Use um nome de 2 a 80 caracteres, sem e-mail.' });
    db.transaction(() => {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
      db.prepare('UPDATE posts SET author_name = ? WHERE author_email = ?').run(name, req.user.email);
    })();
    res.json({ user: publicUser({ ...req.user, name }) });
  });
  const postView = row => ({ id: row.id, author_id: row.author_id, author_name: validName(cleanName(row.author_name)) ? cleanName(row.author_name) : 'Participante', content: row.content, created_at: row.created_at });
  app.get('/api/posts', (req, res) => {
    const rows = db.prepare('SELECT p.*, u.id AS author_id FROM posts p LEFT JOIN users u ON p.author_email = u.email ORDER BY p.created_at DESC, p.id DESC LIMIT 100').all();
    res.json({ posts: rows.map(postView) });
  });
  app.post('/api/posts', requireAuth, (req, res) => {
    const content = req.body?.content;
    if (typeof content !== 'string' || !content.trim() || content.length > 500) return res.status(400).json({ error: 'Escreva de 1 a 500 caracteres.' });
    const info = db.prepare('INSERT INTO posts (author_email, author_name, content) VALUES (?, ?, ?)').run(req.user.email, req.user.name, content.trim());
    res.status(201).json({ post: postView({ ...db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid), author_id: req.user.id }) });
  });
  app.delete('/api/posts/:id', requireAuth, (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ error: 'Publicação não encontrada.' });
    if (post.author_email !== req.user.email) return res.status(403).json({ error: 'Você só pode apagar suas publicações.' });
    db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
    res.json({ ok: true });
  });
  // Lista explícita: nunca disponibilizar banco de dados, código do servidor ou segredos.
  for (const file of ['index.html', 'styles.css', 'app.js', 'community.js']) {
    app.get(file === 'index.html' ? ['/', '/index.html'] : '/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
  }
  app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição muito grande.' });
    console.error(err.message);
    res.status(500).json({ error: 'Não foi possível concluir. Tente novamente.' });
  });
  return { app, db };
}
if (require.main === module) {
  const { app } = createApp();
  app.listen(process.env.PORT || 3000, () => console.log('EcoRotas disponível na porta ' + (process.env.PORT || 3000)));
}
module.exports = { createApp };
