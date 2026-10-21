import { useEffect, useState } from 'react';
import { Detail } from '../components/PageUI.jsx';
const statuses = ['pending', 'wip', 'completed'];
const defaultCategories = ['Learning', 'Household', 'Kids', 'Wife', 'Finance', 'Others', 'Habits'];
const learningSuggestions = ['Python practice', 'JavaScript practice', 'React study', 'TypeScript study'];

const formatTime = (seconds = 0) => {
  const minutes = Math.floor(seconds / 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function Tasks({ day, date, updateTask, addTask, removeDay, settings, setSettings }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Learning');
  const [customCategory, setCustomCategory] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [goalMinutes, setGoalMinutes] = useState('');
  const [view, setView] = useState('today');
  const [weekTasks, setWeekTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [newCategory, setNewCategory] = useState('');
  const [runningTask, setRunningTask] = useState(null);
  const categories = [...new Set([...defaultCategories, ...(settings.taskCategories || [])])];

  useEffect(() => {
    fetch(`/api/tasks?end=${date}&days=7`).then((response) => response.json()).then((data) => setWeekTasks(data.tasks || [])).catch(() => {});
  }, [date, day.tasks]);

  useEffect(() => {
    if (!runningTask) return undefined;
    const timer = setInterval(() => updateTask(runningTask, (task) => ({ timerSeconds: (task.timerSeconds || 0) + 1 })), 1000);
    return () => clearInterval(timer);
  }, [runningTask, updateTask]);

  const status = (task) => task.status || (task.done ? 'completed' : 'pending');
  const pendingWeek = weekTasks.filter((task) => status(task) !== 'completed');
  const allTasks = view === 'today' ? day.tasks.map((task) => ({ ...task, date })) : view === 'week' ? pendingWeek : weekTasks.filter((task) => statusFilter === 'all' || status(task) === statusFilter);
  const activeCategory = category === 'Custom' ? customCategory.trim() : category;

  const submit = (event) => {
    event.preventDefault();
    if (!text.trim() || !activeCategory) return;
    addTask({
      text: text.trim(),
      category: activeCategory,
      recurrence,
      learningGoalMinutes: activeCategory === 'Learning' ? Number(goalMinutes) || 0 : 0,
      startDate: date,
    });
    setText(''); setCustomCategory(''); setRecurrence('none'); setGoalMinutes('');
  };

  const addCategory = (event) => {
    event.preventDefault();
    const value = newCategory.trim();
    if (!value || categories.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setSettings((current) => ({ ...current, taskCategories: [...(current.taskCategories || []), value] }));
    setCategory(value); setNewCategory('');
  };

  return <Detail eyebrow="TASK HUB" title="Tasks" description="Plan work by category, repeat it daily or weekly, and track your learning time.">
    <div className="task-tabs"><button className={view === 'today' ? 'filter-active' : ''} onClick={() => setView('today')}>Today</button><button className={view === 'week' ? 'filter-active' : ''} onClick={() => setView('week')}>Week pending</button><button className={view === 'all' ? 'filter-active' : ''} onClick={() => setView('all')}>All tasks</button></div>
    {view === 'all' && <div className="status-filters">{['all', ...statuses].map((item) => <button className={statusFilter === item ? `filter-active ${item}` : item} onClick={() => setStatusFilter(item)} key={item}>{item}</button>)}</div>}
    <section className="detail-card task-list">
      <div className="task-list-head"><span>Task</span><span>Category</span><span>Status</span><span>Start</span><span>Due</span><span>Actions</span><span>Learning</span></div>
      {allTasks.map((task) => {
        const todayTask = task.date === date;
        const isLearning = task.category === 'Learning';
        const achieved = Number(task.achievedMinutes || 0);
        const timerMinutes = Math.floor((task.timerSeconds || 0) / 60);
        return <div className={`task-detail task-category-${(task.category || 'others').toLowerCase().replace(/[^a-z]+/g, '-')}`} key={`${task.date}-${task.id}`}>
          <input type="checkbox" checked={status(task) === 'completed'} disabled={!todayTask} onChange={(event) => updateTask(task.id, { done: event.target.checked, status: event.target.checked ? 'completed' : 'pending' })} />
          <div className="task-name"><input value={task.text} disabled={!todayTask} onChange={(event) => updateTask(task.id, { text: event.target.value })} />{!todayTask && <small>{task.date}</small>}</div>
          <span className="task-category-label">{task.category || 'Others'}</span>
          {todayTask ? <select value={status(task)} onChange={(event) => updateTask(task.id, { status: event.target.value, done: event.target.value === 'completed' })}>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select> : <span className={`status-badge ${status(task)}`}>{status(task)}</span>}
          {task.recurrence === 'daily' ? <span className="task-date-muted" /> : <label className="task-time"><span>Start</span><input type="date" value={task.startDate || ''} disabled={!todayTask} onChange={(event) => updateTask(task.id, { startDate: event.target.value })} /></label>}
          {task.recurrence === 'daily' ? <span className="task-date-muted" /> : <label className="task-time"><span>Due</span><input type="date" value={task.expectedDate || ''} disabled={!todayTask} onChange={(event) => updateTask(task.id, { expectedDate: event.target.value })} /></label>}
          <div className="task-actions">{todayTask && <button className="text-button remove-task" onClick={() => removeDay('tasks', task.id)}>Remove</button>}</div>
          {isLearning && <div className="learning-task-tools"><label>Goal <input type="number" min="0" value={task.learningGoalMinutes || ''} disabled={!todayTask} onChange={(event) => updateTask(task.id, { learningGoalMinutes: Number(event.target.value) || 0 })} /> min</label><label>Today <input type="number" min="0" value={achieved || ''} disabled={!todayTask} onChange={(event) => updateTask(task.id, { achievedMinutes: Number(event.target.value) || 0 })} /> min</label><span>{formatTime(task.timerSeconds)} · {achieved + timerMinutes} / {task.learningGoalMinutes || 0} min</span>{todayTask && <button onClick={() => setRunningTask(runningTask === task.id ? null : task.id)}>{runningTask === task.id ? 'Stop timer' : 'Start timer'}</button>}</div>}
        </div>;
      })}
      {!allTasks.length && <p className="empty-state">No {view === 'week' ? 'pending tasks this week' : 'tasks to show'}.</p>}
    </section>
    <section className="task-create detail-card">
      <h2>Add a task</h2>
      <form onSubmit={submit} className="task-create-grid">
        <input list="task-suggestions" value={text} onChange={(event) => setText(event.target.value)} placeholder="Choose a suggested task or write your own" />
        <datalist id="task-suggestions">{learningSuggestions.map((item) => <option key={item} value={item} />)}</datalist>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}<option>Custom</option></select>
        {category === 'Custom' && <input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="Your category" />}
        <select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}><option value="none">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
        {activeCategory === 'Learning' && <label className="goal-input"><span>Daily goal</span><input type="number" min="1" value={goalMinutes} onChange={(event) => setGoalMinutes(event.target.value)} placeholder="minutes" /></label>}
        <button>Add task</button>
      </form>
    </section>
    <section className="category-manager detail-card">
      <div><h2>Task categories</h2><p>Choose one of the standard categories or add your own.</p></div>
      <div className="category-chips">{categories.map((item) => <button type="button" key={item} className={category === item ? 'selected-category' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <form onSubmit={addCategory}><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Add a category" /><button>Add category</button></form>
    </section>
  </Detail>;
}
