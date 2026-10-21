import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDir = join(root, 'data');
const settingsFile = join(dataDir, 'settings.json');
const distDir = join(root, 'dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const blankDay = () => ({ movies: [], learning: [], learningNotes: [], tasks: [], expenses: [], trades: [], notes: '', custom: [], habitDone: {}, stopwatchSeconds: 0, focusHeads: [], updatedAt: new Date().toISOString() });
const defaultSettings = () => ({
  goals: [{ id: 'g1', name: 'Learn React', current: 3, target: 12, unit: 'modules', color: 'blue' }, { id: 'g2', name: 'Watch great films', current: 4, target: 20, unit: 'movies', color: 'orange' }],
  habits: [{ id: 'h1', name: 'Read or learn' }, { id: 'h2', name: 'Move your body' }, { id: 'h3', name: 'Daily reflection' }],
  skills: [{ id: 's1', name: 'Python', category: 'Language', progress: 55 }, { id: 's2', name: 'JavaScript', category: 'Language', progress: 40 }, { id: 's3', name: 'TypeScript', category: 'Language', progress: 20 }, { id: 's4', name: 'React', category: 'Framework', progress: 30 }],
  topics: [],
  taskCategories: [],
  recurringTasks: [],
  expenseCategories: [
    { id: 'school', name: 'School', monthlyBudget: 0 },
    { id: 'sports', name: 'Sports', monthlyBudget: 0 },
    { id: 'flat-maintenance', name: 'Flat maintenance', monthlyBudget: 0 },
    { id: 'investment', name: 'Investment', monthlyBudget: 0 },
    { id: 'grocery', name: 'Grocery', monthlyBudget: 0 },
    { id: 'vegetable', name: 'Vegetable', monthlyBudget: 0 },
    { id: 'milk', name: 'Milk', monthlyBudget: 0 },
    { id: 'vehicle', name: 'Bike / car maintenance & fuel', monthlyBudget: 0 }
  ],
  sharePrices: {}
});

async function json(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || '{}');
}
function send(res, status, body, type = 'application/json') { res.writeHead(status, { 'Content-Type': type, ...(type === 'application/json' ? { 'Cache-Control': 'no-store' } : {}) }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
async function loadSettings() {
  try { return { ...defaultSettings(), ...JSON.parse(await readFile(settingsFile, 'utf8')) }; }
  catch { return defaultSettings(); }
}
function dueOnDate(task, date) {
  if (!task.recurrence || task.recurrence === 'none') return false;
  if (task.startDate && task.startDate > date) return false;
  if (task.recurrence === 'daily') return true;
  if (task.recurrence === 'weekly') {
    const start = new Date(`${task.startDate || date}T12:00:00`).getDay();
    return new Date(`${date}T12:00:00`).getDay() === start;
  }
  return false;
}
function withRecurringTasks(record, date, recurringTasks) {
  const tasks = record.tasks || [];
  const additions = recurringTasks.filter((task) => dueOnDate(task, date)).filter((task) => !tasks.some((item) => item.templateId === task.id || (item.recurrence === task.recurrence && item.text === task.text && item.startDate === task.startDate))).map((task) => ({
    ...task, id: `recurring-${task.id}-${date}`, templateId: task.id, done: false, status: 'pending', achievedMinutes: 0, timerSeconds: 0,
  }));
  return { ...blankDay(), ...record, tasks: [...tasks, ...additions] };
}

const sessions = new Map();
const loginAttempts = new Map();
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const cookieName = 'daybook_session';
function sessionCookie(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
function getSession(req) {
  const cookie = req.headers.cookie || '';
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!token) return false;
  const key = createHash('sha256').update(token).digest('hex');
  const expiresAt = sessions.get(key);
  if (!expiresAt || expiresAt <= Date.now()) { sessions.delete(key); return false; }
  return key;
}
function clientKey(req) { return req.socket.remoteAddress || 'unknown'; }
function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
function safeEqual(a, b) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/auth/status' && req.method === 'GET') {
      return sendJson(res, 200, { configured: Boolean(process.env.APP_PASSWORD), authenticated: Boolean(getSession(req)) });
    }
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      if (!process.env.APP_PASSWORD) return sendJson(res, 503, { error: 'Authentication is not configured. Set APP_PASSWORD in the server environment.' });
      const key = clientKey(req); const attempt = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
      if (attempt.blockedUntil > Date.now()) return sendJson(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
      const credentials = await json(req);
      if (!safeEqual(String(credentials.password || ''), process.env.APP_PASSWORD)) {
        attempt.count += 1;
        if (attempt.count >= 8) { attempt.count = 0; attempt.blockedUntil = Date.now() + 15 * 60 * 1000; }
        loginAttempts.set(key, attempt);
        return sendJson(res, 401, { error: 'That password did not match.' });
      }
      loginAttempts.delete(key);
      const token = randomBytes(32).toString('base64url');
      const sessionKey = createHash('sha256').update(token).digest('hex');
      sessions.set(sessionKey, Date.now() + sessionLifetimeMs);
      return sendJson(res, 200, { authenticated: true }, { 'Set-Cookie': sessionCookie(token, sessionLifetimeMs / 1000) });
    }
    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const session = getSession(req); if (session) sessions.delete(session);
      return sendJson(res, 200, { authenticated: false }, { 'Set-Cookie': sessionCookie('', 0) });
    }
    if (url.pathname.startsWith('/api/') && !getSession(req)) return sendJson(res, 401, { error: 'Please sign in to continue.' });
    if (url.pathname === '/api/settings') {
      if (req.method === 'GET') {
        return send(res, 200, await loadSettings());
      }
      if (req.method === 'PUT') {
        const record = { ...defaultSettings(), ...(await json(req)) };
        await mkdir(dataDir, { recursive: true });
        await writeFile(settingsFile, JSON.stringify(record, null, 2));
        return send(res, 200, record);
      }
    }
    if (url.pathname === '/api/days') {
      await mkdir(dataDir, { recursive: true });
      const dates = (await readdir(dataDir)).filter((f) => validDate(f.slice(0, -5)) && f.endsWith('.json')).map((f) => f.slice(0, -5)).sort().reverse();
      return send(res, 200, { dates });
    }
    if (url.pathname === '/api/report') {
      const end = url.searchParams.get('end');
      const count = Math.min(31, Math.max(1, Number(url.searchParams.get('days')) || 7));
      if (!validDate(end || '')) return send(res, 400, { error: 'A valid end date is required.' });
      const start = new Date(`${end}T12:00:00`);
      const records = [];
      for (let offset = 0; offset < count; offset += 1) {
        const current = new Date(start); current.setDate(start.getDate() - offset);
        const date = current.toISOString().slice(0, 10);
        try { records.push({ date, ...JSON.parse(await readFile(join(dataDir, `${date}.json`), 'utf8')) }); } catch {}
      }
      const total = (key) => records.reduce((sum, record) => sum + (record[key]?.length || 0), 0);
      return send(res, 200, { daysLogged: records.length, movies: total('movies'), learning: total('learning'), tasksDone: records.reduce((sum, record) => sum + (record.tasks || []).filter((task) => task.done).length, 0), focusSeconds: records.reduce((sum, record) => sum + (record.stopwatchSeconds || 0) + (record.focusHeads || []).reduce((headTotal, head) => headTotal + (head.elapsedSeconds || 0), 0), 0) });
    }
    if (url.pathname === '/api/tasks') {
      const end = url.searchParams.get('end');
      const count = Math.min(31, Math.max(1, Number(url.searchParams.get('days')) || 7));
      if (!validDate(end || '')) return send(res, 400, { error: 'A valid end date is required.' });
      const start = new Date(`${end}T12:00:00`); const tasks = [];
      for (let offset = 0; offset < count; offset += 1) {
        const current = new Date(start); current.setDate(start.getDate() - offset);
        const date = current.toISOString().slice(0, 10);
        try { const record = JSON.parse(await readFile(join(dataDir, `${date}.json`), 'utf8')); withRecurringTasks(record, date, (await loadSettings()).recurringTasks || []).tasks.forEach((task) => tasks.push({ ...task, date })); } catch { withRecurringTasks(blankDay(), date, (await loadSettings()).recurringTasks || []).tasks.forEach((task) => tasks.push({ ...task, date })); }
      }
      return send(res, 200, { tasks });
    }
    if (url.pathname === '/api/expense-items') {
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      if (!validDate(start || '') || !validDate(end || '') || start > end) return send(res, 400, { error: 'A valid date range is required.' });
      await mkdir(dataDir, { recursive: true });
      const files = (await readdir(dataDir)).filter((file) => file.endsWith('.json') && validDate(file.slice(0, -5)));
      const expenses = [];
      for (const fileName of files) {
        const recordDate = fileName.slice(0, -5);
        try {
          const record = JSON.parse(await readFile(join(dataDir, fileName), 'utf8'));
          for (const expense of record.expenses || []) {
            const expenseDate = validDate(expense.date || '') ? expense.date : recordDate;
            if (expenseDate >= start && expenseDate <= end) expenses.push({ ...expense, date: expenseDate, recordDate });
          }
        } catch {}
      }
      expenses.sort((a, b) => b.date.localeCompare(a.date) || (b.id || '').localeCompare(a.id || ''));
      return send(res, 200, { expenses });
    }
    if (url.pathname === '/api/expenses') {
      const date = url.searchParams.get('date');
      if (!validDate(date || '')) return send(res, 400, { error: 'A valid date is required.' });
      await mkdir(dataDir, { recursive: true });
      const month = date.slice(0, 7); const year = date.slice(0, 4);
      const currentMonth = Number(date.slice(5, 7));
      const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
      const quarterEnd = quarterStart + 2;
      const halfStart = currentMonth <= 6 ? 1 : 7;
      const halfEnd = halfStart + 5;
      const inRange = (value, startMonth, endMonth) => value >= `${year}-${String(startMonth).padStart(2, '0')}-01` && value <= `${year}-${String(endMonth).padStart(2, '0')}-31`;
      const files = (await readdir(dataDir)).filter((file) => validDate(file.slice(0, -5)) && file.endsWith('.json'));
      const totals = { month: {}, quarter: {}, halfYear: {}, year: {} };
      for (const fileName of files) {
        const entryDate = fileName.slice(0, -5);
        if (!entryDate.startsWith(year)) continue;
        try {
          const record = JSON.parse(await readFile(join(dataDir, fileName), 'utf8'));
          for (const expense of record.expenses || []) {
            const expenseDate = validDate(expense.date || '') ? expense.date : entryDate;
            if (expenseDate === date) continue;
            const amount = Number(expense.amount) || 0;
            if (expenseDate.startsWith(year)) totals.year[expense.category] = (totals.year[expense.category] || 0) + amount;
            if (expenseDate.startsWith(month)) totals.month[expense.category] = (totals.month[expense.category] || 0) + amount;
            if (inRange(expenseDate, quarterStart, quarterEnd)) totals.quarter[expense.category] = (totals.quarter[expense.category] || 0) + amount;
            if (inRange(expenseDate, halfStart, halfEnd)) totals.halfYear[expense.category] = (totals.halfYear[expense.category] || 0) + amount;
          }
        } catch {}
      }
      return send(res, 200, totals);
    }
    if (url.pathname === '/api/shares') {
      const end = url.searchParams.get('end');
      if (!validDate(end || '')) return send(res, 400, { error: 'A valid end date is required.' });
      await mkdir(dataDir, { recursive: true });
      const files = (await readdir(dataDir)).filter((file) => validDate(file.slice(0, -5)) && file.endsWith('.json'));
      const trades = [];
      for (const fileName of files) {
        const entryDate = fileName.slice(0, -5);
        if (entryDate > end || entryDate === end) continue;
        try {
          const record = JSON.parse(await readFile(join(dataDir, fileName), 'utf8'));
          for (const trade of record.trades || []) trades.push({ ...trade, date: trade.date || entryDate });
        } catch {}
      }
      return send(res, 200, { trades });
    }
    const match = url.pathname.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})$/);
    if (match) {
      const file = join(dataDir, `${match[1]}.json`);
      if (req.method === 'GET') {
        const settings = await loadSettings();
        try { return send(res, 200, withRecurringTasks(JSON.parse(await readFile(file, 'utf8')), match[1], settings.recurringTasks || [])); }
        catch { return send(res, 200, withRecurringTasks(blankDay(), match[1], settings.recurringTasks || [])); }
      }
      if (req.method === 'PUT') {
        const record = { ...blankDay(), ...(await json(req)), updatedAt: new Date().toISOString() };
        await mkdir(dataDir, { recursive: true });
        await writeFile(file, JSON.stringify(record, null, 2));
        return send(res, 200, record);
      }
    }
    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const asset = normalize(join(distDir, requestPath));
    if (!asset.startsWith(distDir)) return send(res, 403, 'Forbidden', 'text/plain');
    try {
      const info = await stat(asset);
      if (info.isFile()) { res.writeHead(200, { 'Content-Type': mime[extname(asset)] || 'application/octet-stream' }); return createReadStream(asset).pipe(res); }
    } catch {}
    return createReadStream(join(distDir, 'index.html')).pipe(res);
  } catch (error) { send(res, 500, { error: error.message }); }
});
server.listen(process.env.PORT || 5173, process.env.HOST || '0.0.0.0', () => console.log(`Daily Activity Tracker listening on ${process.env.HOST || '0.0.0.0'}:${process.env.PORT || 5173}`));
