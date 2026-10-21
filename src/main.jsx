import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './pages/Dashboard.jsx';
import Goals from './pages/Goals.jsx';
import Tasks from './pages/Tasks.jsx';
import EntryList from './pages/EntryList.jsx';
import Journal from './pages/Journal.jsx';
import Topics from './pages/Topics.jsx';
import LearningNotes from './pages/LearningNotes.jsx';
import Expenses from './pages/Expenses.jsx';
import ShareMarket from './pages/ShareMarket.jsx';
import { percent, uid } from './lib/format.js';
import './styles.css';

const today = () => new Date().toISOString().slice(0, 10);
const blankDay = { movies: [], learning: [], learningNotes: [], tasks: [], expenses: [], trades: [], notes: '', custom: [], habitDone: {}, stopwatchSeconds: 0, focusHeads: [] };
const blankSettings = { goals: [], habits: [], skills: [], topics: [], taskCategories: [], recurringTasks: [], expenseCategories: [], sharePrices: {} };
const navigation = [['dashboard', '⌂', 'Dashboard'], ['goals', '◎', 'Goals'], ['tasks', '☑', 'Tasks'], ['expenses', '₹', 'Expenses'], ['shares', '↗', 'Share market'], ['learningNotes', '▤', 'Learning notes'], ['topics', '✧', 'Topics'], ['movies', '◉', 'Movies'], ['journal', '✎', 'Journal'], ['ideas', '✦', 'Ideas']];

function DashboardGlance() {
  const [now, setNow] = useState(new Date()); const [weather, setWeather] = useState(null);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { fetch('https://api.open-meteo.com/v1/forecast?latitude=12.9716&longitude=77.5946&current=temperature_2m,weather_code&timezone=Asia%2FKolkata').then((response) => response.json()).then((data) => setWeather(data.current)).catch(() => {}); }, []);
  return <div className="dashboard-glance"><span className="glance-time"><b>{now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</b><small>{now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })}</small></span><span className="glance-weather"><i>{weather?.weather_code > 3 ? '☁' : '☀'}</i><b>{weather ? `${Math.round(weather.temperature_2m)}°C` : '—'}</b><small>Bengaluru</small></span></div>;
}

const quotes = ['Small steps, repeated, become a remarkable life.', 'Focus on the next useful thing.', 'Consistency turns ordinary days into extraordinary years.', 'You do not need more time; you need clearer attention.', 'Make today a page worth rereading.'];
function DailyQuote() { const [index, setIndex] = useState(() => new Date().getDate() % quotes.length); return <div className="daily-quote"><span>“{quotes[index]}”</span><button onClick={() => setIndex((current) => (current + 1) % quotes.length)} title="New quote">↻</button></div>; }
function JournalStatus({ hasEntry }) { return <div className={`journal-status ${hasEntry ? 'journal-complete' : ''}`}><span>{hasEntry ? '✓' : '○'}</span>{hasEntry ? 'Journaled today' : 'Journal pending'}</div>; }

function SignIn({ configured, onSignedIn }) {
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
      onSignedIn();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}><div className="auth-mark">⚡</div><p className="eyebrow">YOUR PRIVATE SPACE</p><h1>Welcome back</h1><p className="auth-copy">Sign in to open your Daily Activity Tracker.</p>{configured ? <><label htmlFor="app-password">Password</label><input id="app-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required/><button className="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></> : <p className="auth-error">Authentication is not configured. Set <code>APP_PASSWORD</code> in the server environment, then restart the app.</p>}{error && <p className="auth-error" role="alert">{error}</p>}</form></div>;
}

function App() {
  const [date, setDate] = useState(today()); const [page, setPage] = useState('dashboard'); const [day, setDay] = useState(blankDay); const [settings, setSettingsState] = useState(blankSettings); const [notice, setNotice] = useState(''); const [navCollapsed, setNavCollapsed] = useState(false);
  const [auth, setAuth] = useState(null);
  const dayReady = useRef(false); const settingsReady = useRef(false);
  const setSettings = (update) => setSettingsState((current) => { const next = typeof update === 'function' ? update(current) : update; localStorage.setItem('daybook-settings-backup', JSON.stringify(next)); return next; });
  useEffect(() => { fetch('/api/auth/status').then((response) => response.json()).then(setAuth).catch(() => setAuth({ configured: true, authenticated: false })); }, []);
  useEffect(() => { if (!auth?.authenticated) return; dayReady.current = false; fetch(`/api/day/${date}`).then((response) => response.json()).then((data) => { setDay({ ...blankDay, ...data, habitDone: data.habitDone || {} }); dayReady.current = true; }); }, [date, auth?.authenticated]);
  useEffect(() => { if (!auth?.authenticated) return; const backup = JSON.parse(localStorage.getItem('daybook-settings-backup') || 'null'); fetch('/api/settings').then((response) => response.json()).then((data) => { const useBackup = backup?.topics?.length && !data.topics?.length; setSettingsState(useBackup ? backup : data); settingsReady.current = true; }).catch(() => { if (backup) setSettingsState(backup); settingsReady.current = true; }); }, [auth?.authenticated]);
  useEffect(() => { if (!dayReady.current) return; const timer = setTimeout(async () => { await fetch(`/api/day/${date}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(day) }); setNotice('Saved locally'); }, 600); return () => clearTimeout(timer); }, [day, date]);
  useEffect(() => { if (!settingsReady.current) return; const timer = setTimeout(() => { localStorage.setItem('daybook-settings-backup', JSON.stringify(settings)); fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) }).then(() => setNotice('Saved locally')).catch(() => setNotice('Saved in browser backup')); }, 500); return () => clearTimeout(timer); }, [settings]);
  if (!auth) return <div className="auth-screen"><div className="auth-card">Loading sign-in…</div></div>;
  if (!auth.authenticated) return <SignIn configured={auth.configured} onSignedIn={() => setAuth((current) => ({ ...current, authenticated: true }))}/>;
  const open = (next) => { setPage(next); window.scrollTo(0, 0); }; const doneTasks = day.tasks.filter((task) => task.done).length; const taskPercent = percent(doneTasks, day.tasks.length); const updateTask = (id, patch) => setDay((current) => ({ ...current, tasks: current.tasks.map((task) => { if (task.id !== id) return task; const nextPatch = typeof patch === 'function' ? patch(task) : patch; return { ...task, ...nextPatch }; }) })); const addDay = (key, text) => setDay((current) => ({ ...current, [key]: [...current[key], { id: uid(), text }] })); const addTask = (task) => { const record = { id: uid(), done: false, status: 'pending', timerSeconds: 0, achievedMinutes: 0, ...task }; setDay((current) => ({ ...current, tasks: [...current.tasks, record] })); if (task.recurrence && task.recurrence !== 'none') setSettings((current) => ({ ...current, recurringTasks: [...(current.recurringTasks || []), { ...record, id: uid(), templateId: record.id }] })); }; const removeDay = (key, id) => setDay((current) => ({ ...current, [key]: current[key].filter((item) => item.id !== id) }));
  const pages = { dashboard: <Dashboard {...{ date, setDate, day, settings, open, doneTasks, taskPercent, setDay }} />, goals: <Goals {...{ settings, setSettings }} />, tasks: <Tasks {...{ day, date, updateTask, addTask, removeDay, settings, setSettings }} />, expenses: <Expenses {...{ date, setDate, day, setDay, settings, setSettings }} />, shares: <ShareMarket {...{ date, day, setDay, settings, setSettings }} />, learningNotes: <LearningNotes {...{ date, setDate, day, setDay }} />, topics: <Topics {...{ settings, setSettings }} />, movies: <EntryList title="Movies watched" eyebrow="FILM LOG" description="Keep a watchlist, short reviews, or the feeling a movie left behind." items={day.movies} add={(text) => addDay('movies', text)} remove={(id) => removeDay('movies', id)} placeholder="Add a movie or review" />, journal: <Journal {...{ day, setDay }} />, ideas: <EntryList title="Idea inbox" eyebrow="MAKE ROOM FOR IDEAS" description="A flexible place for new categories, project sparks, and things to explore." items={day.custom} add={(text) => addDay('custom', text)} remove={(id) => removeDay('custom', id)} placeholder="Capture an idea" /> };
  const pageLabel = page === 'dashboard' ? 'Dashboard' : (navigation.find(([key]) => key === page)?.[2] || page);
  return <div className={`app ${navCollapsed ? 'nav-collapsed' : ''}`}><aside><button className="brand" onClick={() => open('dashboard')}><span>⚡</span><b>Life OS</b></button><div className="aside-heading"><p className="aside-label">YOUR SPACE</p><button className="collapse-button" onClick={() => setNavCollapsed((collapsed) => !collapsed)} title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{navCollapsed ? '›' : '‹'}</button></div>{navigation.map(([key, icon, label]) => <button className={`nav-item ${page === key ? 'selected' : ''}`} onClick={() => open(key)} key={key}><i>{icon}</i><span className="nav-label">{label}</span></button>)}</aside><main><header><div><p className="crumb">Home / Life OS / {pageLabel}</p><div className="title-row"><h1>{pageLabel}</h1>{page !== 'dashboard' && <button className="back inline-back" onClick={() => open('dashboard')}>← Dashboard</button>}</div></div>{page === 'dashboard' && <DailyQuote/>}<div className="header-status">{page === 'dashboard' && <DashboardGlance/>}{page === 'dashboard' && <JournalStatus hasEntry={Boolean(day.notes.trim())}/>}<div className="save-dot">● {notice || 'Local-first'}</div><button className="auth-logout" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); setAuth((current) => ({ ...current, authenticated: false })); }}>Sign out</button></div></header>{pages[page]}</main></div>;
}
createRoot(document.getElementById('root')).render(<App />);
