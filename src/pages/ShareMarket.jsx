import { useEffect, useMemo, useState } from 'react';
import { Detail, Progress } from '../components/PageUI.jsx';
import { uid } from '../lib/format.js';

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const number = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value) || 0);

function createHoldings(trades, prices) {
  const holdings = new Map();
  for (const trade of trades) {
    const symbol = (trade.symbol || '').trim().toUpperCase();
    if (!symbol) continue;
    const quantity = Number(trade.quantity) || 0;
    const price = Number(trade.price) || 0;
    const charges = Number(trade.charges) || 0;
    const current = holdings.get(symbol) || { symbol, quantity: 0, buyQuantity: 0, buyValue: 0, sellValue: 0, charges: 0 };
    if (trade.type === 'sell') { current.quantity -= quantity; current.sellValue += quantity * price; current.charges += charges; }
    else { current.quantity += quantity; current.buyQuantity += quantity; current.buyValue += quantity * price; current.charges += charges; }
    holdings.set(symbol, current);
  }
  return [...holdings.values()].filter((item) => item.quantity > 0).map((item) => {
    const averageCost = item.buyQuantity ? (item.buyValue + item.charges) / item.buyQuantity : 0;
    const currentPrice = Number(prices?.[item.symbol]) || 0;
    const invested = item.quantity * averageCost;
    const value = item.quantity * currentPrice;
    return { ...item, averageCost, currentPrice, invested, value, gain: value - invested };
  }).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export default function ShareMarket({ date, day, setDay, settings, setSettings }) {
  const [olderTrades, setOlderTrades] = useState([]);
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [charges, setCharges] = useState('');
  const [note, setNote] = useState('');
  const [tradeDate, setTradeDate] = useState(date);
  const [editing, setEditing] = useState(null);
  const prices = settings.sharePrices || {};
  const allTrades = useMemo(() => [...olderTrades, ...(day.trades || [])], [olderTrades, day.trades]);
  const holdings = useMemo(() => createHoldings(allTrades, prices), [allTrades, prices]);
  const invested = holdings.reduce((total, item) => total + item.invested, 0);
  const marketValue = holdings.reduce((total, item) => total + item.value, 0);
  const gain = marketValue - invested;

  useEffect(() => {
    setTradeDate(date);
    fetch(`/api/shares?end=${date}`).then((response) => response.json()).then((data) => setOlderTrades(data.trades || [])).catch(() => setOlderTrades([]));
  }, [date, day.trades]);

  const addTrade = (event) => {
    event.preventDefault();
    if (!symbol.trim() || !Number(quantity) || !Number(price)) return;
    setDay((current) => ({ ...current, trades: [...(current.trades || []), { id: uid(), symbol: symbol.trim().toUpperCase(), type, quantity: Number(quantity), price: Number(price), charges: Number(charges) || 0, note: note.trim(), date: tradeDate }] }));
    setSymbol(''); setQuantity(''); setPrice(''); setCharges(''); setNote(''); setType('buy');
  };
  const removeTrade = (id) => setDay((current) => ({ ...current, trades: (current.trades || []).filter((trade) => trade.id !== id) }));
  const saveEdit = (event) => {
    event.preventDefault();
    if (!editing?.symbol || !Number(editing.quantity) || !Number(editing.price)) return;
    setDay((current) => ({ ...current, trades: (current.trades || []).map((trade) => trade.id === editing.id ? { ...editing, symbol: editing.symbol.trim().toUpperCase(), quantity: Number(editing.quantity), price: Number(editing.price), charges: Number(editing.charges) || 0 } : trade) }));
    setEditing(null);
  };
  const setSharePrice = (stock, value) => setSettings((current) => ({ ...current, sharePrices: { ...(current.sharePrices || {}), [stock]: Number(value) || 0 } }));

  return <Detail eyebrow="INVESTMENT LEDGER" title="Share market" description="Record your buys and sells, then maintain your current holdings in one place.">
    <section className="share-overview">
      <div className="share-stat"><span>Current holdings</span><strong>{holdings.length}</strong><small>stocks with a positive quantity</small></div>
      <div className="share-stat"><span>Invested cost</span><strong>{money(invested)}</strong><small>based on your recorded transactions</small></div>
      <div className="share-stat"><span>Market value</span><strong>{marketValue ? money(marketValue) : 'Add prices'}</strong><small className={gain >= 0 ? 'positive' : 'negative'}>{marketValue ? `${gain >= 0 ? '+' : ''}${money(gain)} unrealised` : 'enter current prices below'}</small></div>
    </section>

    <section className="detail-card share-holdings">
      <div className="panel-top"><h2>My holdings</h2><span>Enter the latest price to see current value</span></div>
      {holdings.length ? <div className="share-table"><div className="share-table-head"><span>Stock</span><span>Units</span><span>Avg. cost</span><span>Current price</span><span>Value</span><span>Gain / loss</span></div>{holdings.map((holding) => <div className="share-holding" key={holding.symbol}><b>{holding.symbol}</b><span>{number(holding.quantity)}</span><span>{money(holding.averageCost)}</span><input type="number" min="0" step="0.01" value={prices[holding.symbol] || ''} placeholder="₹ price" onChange={(event) => setSharePrice(holding.symbol, event.target.value)} aria-label={`Current price for ${holding.symbol}`} /><span>{holding.currentPrice ? money(holding.value) : '—'}</span><span className={holding.currentPrice && holding.gain < 0 ? 'negative' : 'positive'}>{holding.currentPrice ? `${holding.gain >= 0 ? '+' : ''}${money(holding.gain)}` : '—'}</span></div>)}</div> : <p className="empty-state">No shares held yet. Add a buy transaction below.</p>}
    </section>

    <section className="detail-card share-entry">
      <div className="panel-top"><h2>Record a transaction</h2><span>Saved to your local daily file</span></div>
      <form onSubmit={addTrade}><input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Stock symbol, e.g. INFY" /><select value={type} onChange={(event) => setType(event.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select><input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Quantity" /><input type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price per share (₹)" /><input type="number" min="0" step="0.01" value={charges} onChange={(event) => setCharges(event.target.value)} placeholder="Charges (₹)" /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note (optional)" /><input type="date" value={tradeDate} onChange={(event) => setTradeDate(event.target.value)} /><button>Add transaction</button></form>
    </section>

    <section className="detail-card share-history">
      <div className="panel-top"><h2>Transactions for {new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</h2><span>{(day.trades || []).length} logged</span></div>
      {(day.trades || []).length ? (day.trades || []).map((trade) => editing?.id === trade.id ? <form className="share-edit-row" key={trade.id} onSubmit={saveEdit}><input value={editing.symbol} onChange={(event) => setEditing({ ...editing, symbol: event.target.value })} placeholder="Symbol" /><select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value })}><option value="buy">Buy</option><option value="sell">Sell</option></select><input type="number" value={editing.quantity} onChange={(event) => setEditing({ ...editing, quantity: event.target.value })} placeholder="Quantity" /><input type="number" value={editing.price} onChange={(event) => setEditing({ ...editing, price: event.target.value })} placeholder="Price" /><input type="number" value={editing.charges || ''} onChange={(event) => setEditing({ ...editing, charges: event.target.value })} placeholder="Charges" /><input value={editing.note || ''} onChange={(event) => setEditing({ ...editing, note: event.target.value })} placeholder="Note" /><input type="date" value={editing.date || date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} /><button>Save</button><button type="button" className="text-button" onClick={() => setEditing(null)}>Cancel</button></form> : <div className="share-row" key={trade.id}><b>{trade.symbol}</b><em className={trade.type === 'sell' ? 'sell' : 'buy'}>{trade.type}</em><span>{number(trade.quantity)} × {money(trade.price)}</span><small>{trade.charges ? `Charges ${money(trade.charges)}` : '—'}{trade.note && ` · ${trade.note}`}</small><button className="text-button" onClick={() => setEditing({ ...trade })}>Edit</button><button className="text-button" onClick={() => removeTrade(trade.id)}>Remove</button></div>) : <p className="empty-state">No transactions logged for this day.</p>}
    </section>
    <p className="share-connection-note">Zerodha connection is not enabled yet. This page is a private manual ledger; live holdings require your own Kite Connect API access and a secure sign-in flow.</p>
  </Detail>;
}
