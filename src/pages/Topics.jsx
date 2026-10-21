import { useMemo, useState } from 'react';
import { Detail } from '../components/PageUI.jsx';
import { uid } from '../lib/format.js';

const emptyTopic = () => ({ id: uid(), title: '', category: 'Tech', notes: '', links: [] });
const linkData = (link) => typeof link === 'string' ? { url: link, label: link } : link;

export default function Topics({ settings, setSettings, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState('any');
  const [editing, setEditing] = useState(null);
  const topics = settings.topics || [];
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = useMemo(() => topics.filter((topic) => {
    if (!words.length) return true;
    const text = `${topic.title} ${topic.category} ${topic.notes} ${(topic.links || []).map((link) => `${linkData(link).label} ${linkData(link).url}`).join(' ')}`.toLowerCase();
    return mode === 'all' ? words.every((word) => text.includes(word)) : words.some((word) => text.includes(word));
  }), [topics, query, mode]);
  const add = () => { const topic = emptyTopic(); setSettings((state) => ({ ...state, topics: [...(state.topics || []), topic] })); setEditing(topic.id); };
  const update = (id, patch) => setSettings((state) => ({ ...state, topics: (state.topics || []).map((topic) => topic.id === id ? { ...topic, ...patch } : topic) }));
  const remove = (id) => { setSettings((state) => ({ ...state, topics: (state.topics || []).filter((topic) => topic.id !== id) })); setEditing(null); };
  const currentTopic = topics.find((topic) => topic.id === editing);

  return <Detail eyebrow="KNOWLEDGE BASE" title="Topics" description="Save notes, useful tricks, pointers, and links for anything you want to revisit." action={editing ? undefined : 'Add topic'} onAction={add}>
    {currentTopic ? <TopicEditor topic={currentTopic} update={update} close={() => setEditing(null)} remove={() => remove(currentTopic.id)} /> : <>
      <section className="topic-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Python, cooking, tips..."/><div><button className={mode === 'any' ? 'filter-active' : ''} onClick={() => setMode('any')}>Any words</button><button className={mode === 'all' ? 'filter-active' : ''} onClick={() => setMode('all')}>All words</button></div></section>
      <div className="topic-grid">{filtered.map((topic) => <article className="topic-card" key={topic.id}><span>{topic.category || 'Topic'}</span><h2>{topic.title || 'Untitled topic'}</h2><p>{topic.notes || 'No notes yet.'}</p><div className="topic-links">{(topic.links || []).map((link, index) => { const item = linkData(link); return <a href={item.url} target="_blank" rel="noreferrer" key={`${item.url}-${index}`}>↗ {item.label}</a>; })}</div><button className="text-button" onClick={() => setEditing(topic.id)}>Edit topic</button></article>)}</div>
      {!filtered.length && <button className="empty" onClick={add}>+ Add your first topic</button>}
    </>}
  </Detail>;
}

function TopicEditor({ topic, update, close, remove }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [links, setLinks] = useState(() => topic.links || []);
  const saveLinks = (nextLinks) => { setLinks(nextLinks); update(topic.id, { links: nextLinks }); };
  const addLink = () => { if (!url.trim()) return; saveLinks([...links, { url: url.trim(), label: label.trim() || url.trim() }]); setUrl(''); setLabel(''); };
  return <article className="topic-editor topic-editor-full">
    <div className="editor-heading"><div><p className="eyebrow">EDITING TOPIC</p><h3>{topic.title || 'New topic'}</h3></div><button className="text-button" onClick={close}>← Back to topics</button></div>
    <input className="title-input" value={topic.title} onChange={(event) => update(topic.id, { title: event.target.value })} placeholder="Topic title" autoFocus/>
    <input className="topic-category" value={topic.category} onChange={(event) => update(topic.id, { category: event.target.value })} placeholder="Tech / non-tech category"/>
    <textarea value={topic.notes} onChange={(event) => update(topic.id, { notes: event.target.value })} placeholder="Pointers, tricks, notes, and useful context..."/>
    <div className="link-add"><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Link text, e.g. Stride docs"/><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https:// useful link"/><button onClick={addLink}>Add link</button></div>
    <div className="saved-links">{links.map((link, index) => { const item = linkData(link); return <div key={`${item.url}-${index}`}><a href={item.url} target="_blank" rel="noreferrer">↗ {item.label}</a><button className="text-button" onClick={() => saveLinks(links.filter((_, linkIndex) => linkIndex !== index))}>Remove</button></div>; })}</div>
    <div className="editor-actions"><button onClick={close}>Done</button><button className="text-button" onClick={remove}>Delete topic</button></div>
  </article>;
}
