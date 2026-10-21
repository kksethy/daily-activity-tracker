import { useEffect, useMemo, useState } from 'react';
import { Detail, Progress } from '../components/PageUI.jsx';
import { uid } from '../lib/format.js';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const budgetPeriods = { monthly: { label: 'Monthly', cycles: 12 }, quarterly: { label: 'Quarterly', cycles: 4 }, halfYearly: { label: 'Half-yearly', cycles: 2 }, annually: { label: 'Annual', cycles: 1 } };
const periodRange = (date, period) => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const firstMonth = period === 'quarterly' ? Math.floor((month - 1) / 3) * 3 + 1 : period === 'halfYearly' ? (month <= 6 ? 1 : 7) : 1;
  const lastMonth = period === 'monthly' ? month : period === 'quarterly' ? firstMonth + 2 : period === 'halfYearly' ? firstMonth + 5 : 12;
  const start = `${year}-${String(firstMonth).padStart(2, '0')}-01`;
  const end = `${year}-${String(lastMonth).padStart(2, '0')}-${new Date(year, lastMonth, 0).getDate()}`;
  return { start, end };
};

export default function Expenses({ date, setDate, day, setDay, settings, setSettings }) {
  const [totals, setTotals] = useState({ month: {}, quarter: {}, halfYear: {}, year: {} });
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentName, setPaymentName] = useState('');
  const [expenseDate, setExpenseDate] = useState(date);
  const [newCategory, setNewCategory] = useState('');
  const [newCategoryPeriod, setNewCategoryPeriod] = useState('monthly');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [historyCategory, setHistoryCategory] = useState('');
  const [historyRange, setHistoryRange] = useState({ start: date, end: date, label: 'Selected day' });
  const [historyExpenses, setHistoryExpenses] = useState([]);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const categories = settings.expenseCategories || [];
  const selectedCategory = category || categories[0]?.id || '';
  const liveTotals = useMemo(() => {
    const month = { ...(totals.month || {}) };
    const quarter = { ...(totals.quarter || {}) };
    const halfYear = { ...(totals.halfYear || {}) };
    const year = { ...(totals.year || {}) };
    const currentMonth = Number(date.slice(5, 7));
    const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
    const halfStart = currentMonth <= 6 ? 1 : 7;
    const inCurrentRange = (value, startMonth, endMonth) => value >= `${date.slice(0, 4)}-${String(startMonth).padStart(2, '0')}-01` && value <= `${date.slice(0, 4)}-${String(endMonth).padStart(2, '0')}-31`;
    for (const expense of day.expenses || []) {
      const expenseDate = expense.date || date;
      const amountValue = Number(expense.amount) || 0;
      if (expenseDate.startsWith(date.slice(0, 7))) month[expense.category] = (month[expense.category] || 0) + amountValue;
      if (inCurrentRange(expenseDate, quarterStart, quarterStart + 2)) quarter[expense.category] = (quarter[expense.category] || 0) + amountValue;
      if (inCurrentRange(expenseDate, halfStart, halfStart + 5)) halfYear[expense.category] = (halfYear[expense.category] || 0) + amountValue;
      if (expenseDate.startsWith(date.slice(0, 4))) year[expense.category] = (year[expense.category] || 0) + amountValue;
    }
    return { month, quarter, halfYear, year };
  }, [date, day.expenses, totals]);

  useEffect(() => {
    setExpenseDate(date);
    setHistoryRange({ start: date, end: date, label: 'Selected day' });
    setHistoryCategory('');
    fetch(`/api/expenses?date=${date}`).then((response) => response.json()).then(setTotals).catch(() => setTotals({ month: {}, quarter: {}, halfYear: {}, year: {} }));
  }, [date, day.expenses]);

  useEffect(() => {
    fetch(`/api/expense-items?start=${historyRange.start}&end=${historyRange.end}`).then((response) => response.json()).then((data) => setHistoryExpenses(data.expenses || [])).catch(() => setHistoryExpenses([]));
  }, [historyRange.start, historyRange.end, historyRefresh]);

  const monthTotal = useMemo(() => Object.values(liveTotals.month).reduce((sum, value) => sum + value, 0), [liveTotals]);
  const annualTotal = useMemo(() => Object.values(liveTotals.year).reduce((sum, value) => sum + value, 0), [liveTotals]);
  const periodFor = (item) => budgetPeriods[item.budgetPeriod] || budgetPeriods.monthly;
  const baseBudgetFor = (item) => item.budgetPeriod && item.budgetPeriod !== 'monthly' ? Number(item.budgetAmount) || 0 : Number(item.monthlyBudget) || 0;
  const annualBudgetFor = (item) => baseBudgetFor(item) * periodFor(item).cycles;
  const monthlyBudgetTotal = categories.reduce((sum, item) => sum + annualBudgetFor(item) / 12, 0);
  const annualBudgetTotal = monthlyBudgetTotal * 12;
  const monthProgress = monthlyBudgetTotal ? Math.min(100, Math.round((monthTotal / monthlyBudgetTotal) * 100)) : 0;
  const yearProgress = annualBudgetTotal ? Math.min(100, Math.round((annualTotal / annualBudgetTotal) * 100)) : 0;

  const addExpense = (event) => {
    event.preventDefault();
    if (!selectedCategory || !Number(amount)) return;
    const expense = { id: uid(), category: selectedCategory, subcategory: subcategory.trim(), description: description.trim(), note: note.trim(), paymentMode, paymentName: paymentName.trim(), amount: Number(amount), date: expenseDate };
    const save = expenseDate === date
      ? Promise.resolve(setDay((current) => ({ ...current, expenses: [...(current.expenses || []), expense] })))
      : fetch(`/api/day/${expenseDate}`).then((response) => response.json()).then((record) => fetch(`/api/day/${expenseDate}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...record, expenses: [...(record.expenses || []), expense] }) }));
    Promise.resolve(save).then(() => { if (expenseDate !== date) setDate(expenseDate); setHistoryCategory(''); }).catch(() => window.alert('Could not save this expense. Please try again.'));
    setAmount(''); setSubcategory(''); setDescription(''); setNote(''); setPaymentMode('Cash'); setPaymentName('');
  };

  const updateBudget = (id, budgetAmount) => setSettings((current) => ({ ...current, expenseCategories: (current.expenseCategories || []).map((item) => item.id === id ? (item.budgetPeriod && item.budgetPeriod !== 'monthly' ? { ...item, budgetAmount: Number(budgetAmount) || 0 } : { ...item, monthlyBudget: Number(budgetAmount) || 0 }) : item) }));
  const updateCategory = (id, patch) => setSettings((current) => ({ ...current, expenseCategories: (current.expenseCategories || []).map((item) => item.id === id ? { ...item, ...patch } : item) }));
  const updateCategoryPeriod = (id, nextPeriod) => {
    const current = categories.find((item) => item.id === id);
    if (!current) return;
    const nextAmount = annualBudgetFor(current) / budgetPeriods[nextPeriod].cycles;
    updateCategory(id, nextPeriod === 'monthly' ? { budgetPeriod: nextPeriod, monthlyBudget: nextAmount } : { budgetPeriod: nextPeriod, budgetAmount: nextAmount });
  };
  const addCategory = (event) => {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name || categories.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    const id = uid();
    setSettings((current) => ({ ...current, expenseCategories: [...(current.expenseCategories || []), { id, name, budgetPeriod: newCategoryPeriod, monthlyBudget: 0, budgetAmount: 0 }] }));
    setCategory(id); setNewCategory(''); setNewCategoryPeriod('monthly');
  };
  const updateExpenseFile = async (fileDate, update) => {
    const response = await fetch(`/api/day/${fileDate}`);
    if (!response.ok) throw new Error('Could not load the selected day.');
    const record = await response.json();
    const saved = await fetch(`/api/day/${fileDate}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...record, expenses: update(record.expenses || []) }) });
    if (!saved.ok) throw new Error('Could not save expenses.');
  };
  const removeExpense = (id, recordDate) => {
    if (recordDate === date) setDay((current) => ({ ...current, expenses: (current.expenses || []).filter((item) => item.id !== id) }));
    else updateExpenseFile(recordDate, (items) => items.filter((item) => item.id !== id)).then(() => setHistoryRefresh((count) => count + 1)).catch(() => window.alert('Could not remove this expense. Please try again.'));
  };
  const saveExpenseEdit = (event) => {
    event.preventDefault();
    if (!editingExpense || !Number(editingExpense.amount)) return;
    const sourceDate = editingExpense.recordDate || editingExpense.date || date;
    const expenseFields = Object.fromEntries(Object.entries(editingExpense).filter(([key]) => key !== 'recordDate'));
    const updated = { ...expenseFields, amount: Number(editingExpense.amount), date: editingExpense.date || sourceDate };
    const save = async () => {
      if (sourceDate !== updated.date) await updateExpenseFile(sourceDate, (items) => items.filter((item) => item.id !== updated.id));
      await updateExpenseFile(updated.date, (items) => items.some((item) => item.id === updated.id) ? items.map((item) => item.id === updated.id ? updated : item) : [...items, updated]);
      if (sourceDate === date || updated.date === date) setDay((current) => ({ ...current, expenses: current.expenses.filter((item) => item.id !== updated.id).concat(updated.date === date ? [updated] : []) }));
      setHistoryRefresh((count) => count + 1);
    };
    save().catch(() => window.alert('Could not save this expense. Please try again.'));
    setEditingExpense(null);
  };
  const openExpenseHistory = (categoryId = '', period = 'monthly') => {
    const range = periodRange(date, period);
    const year = date.slice(0, 4);
    const month = Number(date.slice(5, 7));
    const label = period === 'monthly' ? new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : period === 'quarterly' ? `Q${Math.ceil(month / 3)} ${year}`
        : period === 'halfYearly' ? `${month <= 6 ? 'Jan–Jun' : 'Jul–Dec'} ${year}` : year;
    setHistoryRange({ ...range, label });
    setHistoryCategory(categoryId);
    document.getElementById('expense-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const visibleExpenses = historyExpenses.filter((item) => !historyCategory || item.category === historyCategory);
  const deleteCategory = (id) => {
    const current = categories.find((item) => item.id === id);
    if (!current || !window.confirm(`Delete “${current.name}”? Existing expense records will remain.`)) return;
    setSettings((value) => ({ ...value, expenseCategories: (value.expenseCategories || []).filter((item) => item.id !== id) }));
    if (category === id) setCategory('');
  };

  return <Detail eyebrow="MONEY LOG" title="Expenses" description="Set a monthly budget, record daily spending, and see what remains this month and year.">
    <section className="expense-overview">
      <div className="expense-total-card"><span>This month</span><div className="expense-total-values"><div><small>Spent</small><strong>{money(monthTotal)}</strong></div><div><small>Budget</small><strong>{money(monthlyBudgetTotal)}</strong></div></div><Progress value={monthProgress} color={monthTotal > monthlyBudgetTotal && monthlyBudgetTotal ? 'orange' : 'green'} /><small>{monthProgress}% used · {new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</small><button type="button" className="expense-link" onClick={() => openExpenseHistory('', 'monthly')}>View this month's expenses →</button></div>
      <div className="expense-total-card"><span>This year</span><div className="expense-total-values"><div><small>Spent</small><strong>{money(annualTotal)}</strong></div><div><small>Budget</small><strong>{money(annualBudgetTotal)}</strong></div></div><Progress value={yearProgress} color={annualTotal > annualBudgetTotal && annualBudgetTotal ? 'orange' : 'green'} /><small>{yearProgress}% used · {categories.length} categories</small><button type="button" className="expense-link" onClick={() => openExpenseHistory('', 'annually')}>View this year's expenses →</button></div>
    </section>

    <section className="detail-card budget-card">
      <div className="panel-top"><h2>Monthly budgets</h2><span>Annual budget is calculated as monthly budget × 12</span></div>
      <div className="budget-grid">
        {categories.map((item) => {
          const period = periodFor(item);
          const budget = baseBudgetFor(item);
          const spent = Number(liveTotals.month?.[item.id]) || 0;
          const yearSpent = Number(liveTotals.year?.[item.id]) || 0;
          const annualBudget = annualBudgetFor(item);
          const budgetForMonth = annualBudget / 12;
          const periodSpent = period === budgetPeriods.monthly ? spent : item.budgetPeriod === 'quarterly' ? Number(liveTotals.quarter?.[item.id]) || 0 : item.budgetPeriod === 'halfYearly' ? Number(liveTotals.halfYear?.[item.id]) || 0 : yearSpent;
          const progress = budget ? Math.min(100, Math.round((periodSpent / budget) * 100)) : 0;
          return <article className="budget-line" key={item.id}>
            <div className="budget-title"><b>{item.name}</b><div className="budget-fields"><label>{period.label} <input type="number" min="0" value={budget || ''} placeholder="₹ 0" onChange={(event) => updateBudget(item.id, event.target.value)} /></label><label>{item.budgetPeriod === 'annually' ? 'Monthly avg' : 'Annual'} <input type="number" value={(item.budgetPeriod === 'annually' ? annualBudget / 12 : annualBudget) || ''} placeholder="₹ 0" readOnly aria-label="Calculated budget" /></label></div></div>
            <Progress value={progress} color={spent > budget && budget ? 'orange' : 'green'} />
            <p><span>{money(periodSpent)} spent</span><b>{money(budget - periodSpent)} left</b></p>
            <small>Year: {money(yearSpent)} / {money(annualBudget)}</small>
            <button type="button" className="expense-link" onClick={() => openExpenseHistory(item.id, item.budgetPeriod || 'monthly')}>View {item.name} expenses →</button>
          </article>;
        })}
      </div>
    </section>

    <section className="detail-card expense-entry">
      <div className="panel-top"><h2>Record an expense</h2><span>Saved to your local daily file</span></div>
      <form onSubmit={addExpense}>
        <input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount (₹)" />
        <select value={selectedCategory} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
        <input value={subcategory} onChange={(event) => setSubcategory(event.target.value)} placeholder="Subcategory, e.g. tuition / fuel" />
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
        <select value={paymentMode} onChange={(event) => { setPaymentMode(event.target.value); if (event.target.value === 'Cash') setPaymentName(''); }}><option>Cash</option><option>UPI</option><option>Credit Card</option></select>
        {paymentMode !== 'Cash' && <input value={paymentName} onChange={(event) => setPaymentName(event.target.value)} placeholder={paymentMode === 'UPI' ? 'UPI name, e.g. GPay' : 'Card name, e.g. HDFC Regalia'} />}
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note or merchant (optional)" />
        <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
        <button>Add expense</button>
      </form>
    </section>

    <section className="detail-card expense-history" id="expense-history">
      <div className="panel-top">
        <h2>Expenses · {historyRange.label}{historyCategory ? ` · ${categories.find((item) => item.id === historyCategory)?.name || 'Category'}` : ''}</h2>
        <span>
          {money(visibleExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}
          {historyCategory && <button type="button" className="expense-link" onClick={() => setHistoryCategory('')}>View overall</button>}
        </span>
      </div>
      {visibleExpenses.length ? visibleExpenses.map((expense) => editingExpense?.id === expense.id ? (
        <form className="expense-edit-row" key={expense.id} onSubmit={saveExpenseEdit}>
          <input type="number" min="1" step="0.01" value={editingExpense.amount} onChange={(event) => setEditingExpense({ ...editingExpense, amount: event.target.value })} placeholder="Amount" />
          <select value={editingExpense.category || ''} onChange={(event) => setEditingExpense({ ...editingExpense, category: event.target.value })}>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <input value={editingExpense.subcategory || ''} onChange={(event) => setEditingExpense({ ...editingExpense, subcategory: event.target.value })} placeholder="Subcategory" />
          <input value={editingExpense.description || ''} onChange={(event) => setEditingExpense({ ...editingExpense, description: event.target.value })} placeholder="Description" />
          <select value={editingExpense.paymentMode || 'Cash'} onChange={(event) => setEditingExpense({ ...editingExpense, paymentMode: event.target.value, paymentName: event.target.value === 'Cash' ? '' : editingExpense.paymentName || '' })}><option>Cash</option><option>UPI</option><option>Credit Card</option></select>
          {editingExpense.paymentMode !== 'Cash' && <input value={editingExpense.paymentName || ''} onChange={(event) => setEditingExpense({ ...editingExpense, paymentName: event.target.value })} placeholder="UPI / card name" />}
          <input type="date" value={editingExpense.date || date} onChange={(event) => setEditingExpense({ ...editingExpense, date: event.target.value })} />
          <button>Save</button><button type="button" className="text-button" onClick={() => setEditingExpense(null)}>Cancel</button>
        </form>
      ) : (
        <div className="expense-row" key={expense.id}>
          <b>{money(expense.amount)}</b>
          <span>{categories.find((item) => item.id === expense.category)?.name || ''}</span>
          <small>{new Date(`${expense.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {expense.subcategory || expense.description || expense.note || '—'}</small>
          <em>{expense.paymentMode || 'Cash'}{expense.paymentName && <> · {expense.paymentName}</>}</em>
          <button className="text-button" onClick={() => setEditingExpense({ ...expense })}>Edit</button>
          <button className="text-button" onClick={() => removeExpense(expense.id, expense.recordDate || expense.date || date)}>Remove</button>
        </div>
      )) : <p className="empty-state">No expenses found for this period.</p>}
    </section>
    <section className="detail-card expense-category-manager">
      <div className="panel-top"><h2>Manage expense categories</h2><span>Rename, change the budget period, or remove a category.</span></div>
      <div className="expense-category-list">{categories.map((item) => { const editing = editingCategoryId === item.id; return <div key={item.id}>{editing ? <><input value={item.name} onChange={(event) => updateCategory(item.id, { name: event.target.value })} aria-label="Category name" /><select value={item.budgetPeriod || 'monthly'} onChange={(event) => updateCategoryPeriod(item.id, event.target.value)} aria-label="Budget period"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="halfYearly">Half-yearly</option><option value="annually">Annual</option></select><button className="text-button" onClick={() => setEditingCategoryId(null)}>Done</button></> : <><b>{item.name}</b><span>{periodFor(item).label}</span><button className="text-button" onClick={() => setEditingCategoryId(item.id)}>Edit</button></>}<button className="text-button delete-category" onClick={() => deleteCategory(item.id)}>Delete</button></div>; })}</div>
      <form className="expense-category-add" onSubmit={addCategory}><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Add a new budget category" /><select value={newCategoryPeriod} onChange={(event) => setNewCategoryPeriod(event.target.value)}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="halfYearly">Half-yearly</option><option value="annually">Annual</option></select><button>Add category</button></form>
    </section>
  </Detail>;
}
