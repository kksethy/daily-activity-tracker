import { useEffect, useRef, useState } from 'react';
import { Detail, Progress } from '../components/PageUI.jsx';
import { clock, percent, uid } from '../lib/format.js';

export default function Focus({ day, setDay, stopwatchOn, setStopwatchOn, activeFocusId, setActiveFocusId }) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(25);
  const audioContext = useRef(null);
  const armSound = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioContext.current) audioContext.current = new AudioContext();
    if (audioContext.current.state === 'suspended') audioContext.current.resume();
  };
  const playCompletionSound = () => {
    const context = audioContext.current;
    if (!context || context.state !== 'running') return;
    const start = context.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25, 659.25].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = start + index * 0.48;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.22, noteStart + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.43);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.46);
    });
  };
  const add = (event) => {
    event.preventDefault();
    if (!name.trim() || Number(minutes) <= 0) return;
    setDay((current) => ({ ...current, focusHeads: [...current.focusHeads, { id: uid(), name: name.trim(), targetSeconds: Number(minutes) * 60, elapsedSeconds: 0 }] }));
    setName('');
    setMinutes(25);
  };
  const resetHead = (id) => setDay((current) => ({ ...current, focusHeads: current.focusHeads.map((head) => head.id === id ? { ...head, elapsedSeconds: 0 } : head) }));
  const removeHead = (id) => {
    if (activeFocusId === id) setActiveFocusId(null);
    setDay((current) => ({ ...current, focusHeads: current.focusHeads.filter((head) => head.id !== id) }));
  };
  useEffect(() => {
    const active = day.focusHeads.find((head) => head.id === activeFocusId);
    if (active && active.elapsedSeconds >= active.targetSeconds) {
      playCompletionSound();
      setActiveFocusId(null);
    }
  }, [activeFocusId, day.focusHeads, setActiveFocusId]);

  return <Detail eyebrow="DEEP WORK" title="Focus" description="Use the stopwatch for open-ended work, and a timer for each topic you want to study today.">
    <section className="stopwatch-card"><div><p className="eyebrow">STOPWATCH</p><strong>{clock(day.stopwatchSeconds)}</strong><span>Tracks an open focus session</span></div><div><button onClick={() => setStopwatchOn(!stopwatchOn)}>{stopwatchOn ? 'Pause stopwatch' : 'Start stopwatch'}</button><button className="light-button" onClick={() => setDay((current) => ({ ...current, stopwatchSeconds: 0 }))}>Reset</button></div></section>
    <section className="detail-card topic-timers">
      <div className="panel-top"><div><h2>Topic timers</h2><p>Choose a head and a planned duration.</p></div></div>
      <form className="topic-form" onSubmit={add}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Python reading"/><label><input type="number" min="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} /> min</label><button>Add timer</button></form>
      <div className="topic-timer-grid">{day.focusHeads.map((head) => {
        const complete = head.elapsedSeconds >= head.targetSeconds;
        return <article key={head.id} className={activeFocusId === head.id ? 'timer-active' : ''}>
          <div className="topic-title"><b>{head.name}</b><span>{clock(head.elapsedSeconds)} spent · {clock(Math.max(0, head.targetSeconds - head.elapsedSeconds))} left</span></div>
          <Progress value={percent(head.elapsedSeconds, head.targetSeconds)} color={complete ? 'green' : 'blue'} />
          <div className="topic-actions"><button disabled={complete} onClick={() => { armSound(); setActiveFocusId(activeFocusId === head.id ? null : head.id); }}>{activeFocusId === head.id ? 'Pause' : complete ? 'Completed' : 'Start timer'}</button><button className="light-button" onClick={() => resetHead(head.id)}>Reset</button><button className="text-button" onClick={() => removeHead(head.id)}>Remove</button></div>
        </article>;
      })}</div>
      {!day.focusHeads.length && <p className="empty-state">Add a head such as “Python reading — 20 min” or “JavaScript — 30 min”.</p>}
    </section>
  </Detail>;
}
