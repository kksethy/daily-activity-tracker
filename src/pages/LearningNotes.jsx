import { useEffect, useRef, useState } from 'react';
import { Detail } from '../components/PageUI.jsx';
import { uid } from '../lib/format.js';

const plainToHtml = (text = '') => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
const textFromHtml = (html = '') => html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
const fileAsDataUrl = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
const inlineImages = async (html) => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  await Promise.all([...wrapper.querySelectorAll('img')].map(async (image) => {
    if (image.src.startsWith('blob:')) image.src = await fileAsDataUrl(await fetch(image.src).then((response) => response.blob()));
  }));
  return wrapper.innerHTML;
};

function RichNoteEditor({ value, onChange }) {
  const editor = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  useEffect(() => { if (editor.current && document.activeElement !== editor.current) editor.current.innerHTML = value; }, [value]);
  const format = (command, value = null) => { editor.current?.focus(); document.execCommand(command, false, value); onChange(editor.current?.innerHTML || ''); };
  const resizeImage = (width) => {
    if (!selectedImage) return;
    selectedImage.style.width = `${width}%`;
    selectedImage.style.height = 'auto';
    onChange(editor.current?.innerHTML || '');
  };
  const beginImageResize = (event) => {
    if (event.target.tagName !== 'IMG' || !editor.current) return;
    event.preventDefault();
    const image = event.target;
    setSelectedImage(image);
    const startX = event.clientX;
    const startWidth = image.getBoundingClientRect().width;
    const editorWidth = editor.current.getBoundingClientRect().width - 24;
    const resize = (moveEvent) => {
      const width = Math.max(90, Math.min(editorWidth, startWidth + moveEvent.clientX - startX));
      image.style.width = `${Math.round((width / editorWidth) * 100)}%`;
      image.style.height = 'auto';
    };
    const finish = () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', finish);
      onChange(editor.current?.innerHTML || '');
    };
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', finish);
  };
  const paste = (event) => {
    const image = [...event.clipboardData.items].find((item) => item.type.startsWith('image/'));
    if (!image) return;
    event.preventDefault();
    fileAsDataUrl(image.getAsFile()).then((source) => { document.execCommand('insertImage', false, source); const inserted = editor.current?.querySelector('img:last-of-type'); if (inserted) inserted.style.width = '48%'; onChange(editor.current?.innerHTML || ''); });
  };
  return <div className="rich-note-editor-wrap"><div className="rich-toolbar"><div className="text-format-controls"><select className="font-picker" defaultValue="" onChange={(event) => { if (event.target.value) { format('fontName', event.target.value); event.target.value = ''; } }} title="Font family"><option value="">Font</option><option value="'DM Sans'">DM Sans</option><option value="Manrope">Manrope</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="'Courier New'">Courier New</option></select><select className="font-picker size-picker" defaultValue="" onChange={(event) => { if (event.target.value) { format('fontSize', event.target.value); event.target.value = ''; } }} title="Font size"><option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">X-Large</option></select><button type="button" onMouseDown={(event) => { event.preventDefault(); format('bold'); }} title="Bold (Cmd+B / Ctrl+B)"><b>B</b></button><button type="button" onMouseDown={(event) => { event.preventDefault(); format('italic'); }} title="Italic"><i>I</i></button><button type="button" onMouseDown={(event) => { event.preventDefault(); format('strikeThrough'); }} title="Strike-through"><s>S</s></button>{['#20242b', '#287fc5', '#be5252', '#38876f', '#8c5bb5'].map((color) => <button type="button" className="text-color" style={{ backgroundColor: color }} key={color} onMouseDown={(event) => { event.preventDefault(); format('foreColor', color); }} title={`Set text color to ${color}`} />)}</div>{selectedImage && <span className="image-size-controls"><button type="button" onMouseDown={(event) => { event.preventDefault(); resizeImage(50); }}>50%</button><button type="button" onMouseDown={(event) => { event.preventDefault(); resizeImage(75); }}>75%</button><button type="button" onMouseDown={(event) => { event.preventDefault(); resizeImage(100); }}>100%</button></span>}</div><div ref={editor} className="rich-note-editor" contentEditable role="textbox" aria-multiline="true" data-placeholder="Write concepts, examples, tricks, questions, or links to revisit..." onMouseDown={beginImageResize} onPaste={paste} onInput={(event) => onChange(event.currentTarget.innerHTML)} /></div>;
}

export default function LearningNotes({ date, setDate, day, setDay }) {
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    let live = true;
    fetch('/api/days').then((response) => response.json()).then(async ({ dates = [] }) => {
      const records = await Promise.all(dates.slice(0, 90).map(async (noteDate) => {
        const data = await fetch(`/api/day/${noteDate}`).then((response) => response.json());
        return (data.learningNotes || []).map((note) => ({ ...note, date: noteDate }));
      }));
      if (live) setHistory(records.flat().sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`)));
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  const clearEditor = () => { setTopic(''); setContent(''); setEditing(null); };
  const save = async () => {
    if (!topic.trim() || (!textFromHtml(content) && !/<img\b/i.test(content))) return;
    const savedContent = await inlineImages(content);
    if (editing) {
      const next = { ...editing, topic: topic.trim(), content: savedContent, rich: true };
      setDay((current) => ({ ...current, learningNotes: (current.learningNotes || []).map((note) => note.id === editing.id ? { ...note, topic: next.topic, content: next.content, rich: true } : note) }));
      setHistory((current) => current.map((note) => note.id === editing.id && note.date === date ? next : note));
    } else {
      const note = { id: uid(), topic: topic.trim(), content: savedContent, rich: true, createdAt: new Date().toISOString() };
      setDay((current) => ({ ...current, learningNotes: [...(current.learningNotes || []), note] }));
      setHistory((current) => [{ ...note, date }, ...current]);
    }
    clearEditor();
  };
  const startEdit = (note) => { if (note.date !== date) setDate(note.date); setViewing(null); setEditing(note); setTopic(note.topic); setContent(note.rich ? note.content : plainToHtml(note.content)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = (note) => {
    if (!window.confirm(`Delete the note “${note.topic}”? This cannot be undone.`)) return;
    if (note.date === date) setDay((current) => ({ ...current, learningNotes: (current.learningNotes || []).filter((item) => item.id !== note.id) }));
    else fetch(`/api/day/${note.date}`).then((response) => response.json()).then((record) => fetch(`/api/day/${note.date}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...record, learningNotes: (record.learningNotes || []).filter((item) => item.id !== note.id) }) })).catch(() => {});
    setHistory((current) => current.filter((item) => !(item.id === note.id && item.date === note.date)));
    if (editing?.id === note.id) clearEditor();
    if (viewing?.id === note.id) setViewing(null);
  };
  const matches = history.filter((note) => `${note.topic} ${textFromHtml(note.content)}`.toLowerCase().includes(search.toLowerCase()));

  if (viewing) return <Detail eyebrow="STUDY NOTEBOOK" title="Learning notes" description="Full note view."><section className="detail-card note-full-page"><div className="note-full-heading"><div><span>{new Date(`${viewing.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><h2>{viewing.topic}</h2></div><div className="note-actions"><button className="text-button" onClick={() => setViewing(null)}>← All notes</button><button className="text-button" onClick={() => startEdit(viewing)}>Edit</button><button className="text-button delete-note" onClick={() => remove(viewing)}>Delete</button></div></div><div className="learning-note-content full-note-content" dangerouslySetInnerHTML={{ __html: viewing.rich ? viewing.content : plainToHtml(viewing.content) }} /></section></Detail>;

  return <Detail eyebrow="STUDY NOTEBOOK" title="Learning notes" description="Write dated notes while studying Python, React, or any topic. Your notes stay in your local daily files.">
    <div className="learning-notes-layout">
      <section className="detail-card note-composer"><div className="panel-top"><h2>{editing ? 'Edit note' : 'Note for'}</h2><label className="date-picker"><input type="date" value={date} onChange={(event) => { clearEditor(); setDate(event.target.value); }} /></label></div><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic, e.g. Python dictionaries"/><RichNoteEditor value={content} onChange={setContent}/><div><div><button onClick={save}>{editing ? 'Save changes' : 'Save note'}</button>{editing && <button className="text-button cancel-edit" onClick={clearEditor}>Cancel</button>}</div><small>{(day.learningNotes || []).length} note{(day.learningNotes || []).length === 1 ? '' : 's'} on this date</small></div></section>
      <section className="detail-card note-history"><div className="panel-top"><div><h2>All learning notes</h2><p>Scroll through your dated study history.</p></div></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all notes..."/><div className="note-history-scroll">{matches.length ? matches.map((note) => <article key={`${note.date}-${note.id}`} className="learning-note"><div className="learning-note-title"><div><span>{new Date(`${note.date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><h3>{note.topic}</h3></div><div className="note-actions"><button className="text-button" onClick={() => setViewing(note)}>Open full page</button><button className="text-button" onClick={() => startEdit(note)}>Edit</button><button className="text-button delete-note" onClick={() => remove(note)}>Delete</button></div></div><div className="learning-note-content" dangerouslySetInnerHTML={{ __html: note.rich ? note.content : plainToHtml(note.content) }} /></article>) : <p className="empty-state">No learning notes found yet.</p>}</div></section>
    </div>
  </Detail>;
}
