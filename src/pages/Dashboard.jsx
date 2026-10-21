import { Empty, Progress } from "../components/PageUI.jsx";
import { clock, percent } from "../lib/format.js";

function TileButton({ icon, label, value, detail, progress, onClick }) {
  return (
    <button className="summary-card" onClick={onClick}>
      <span className="tile-icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
        {progress !== undefined && <Progress value={progress} />}
      </div>
      <span className="arrow">→</span>
    </button>
  );
}
function PanelLink({ title, action, onClick, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-top">
        <h2>{title}</h2>
        <button onClick={onClick}>{action} →</button>
      </div>
      {children}
    </section>
  );
}
function LifeTile({ icon, title, text, onClick }) {
  return (
    <button className="life-tile" onClick={onClick}>
      <i>{icon}</i>
      <b>{title}</b>
      <span>{text}</span>
      <em>Open →</em>
    </button>
  );
}

export default function Dashboard({
  date,
  setDate,
  day,
  settings,
  open,
  doneTasks,
  doneHabits,
  taskPercent,
  habitPercent,
  setDay,
}) {
  const spent = day.focusHeads.reduce(
    (sum, head) => sum + head.elapsedSeconds,
    0,
  );
  const planned = day.focusHeads.reduce(
    (sum, head) => sum + head.targetSeconds,
    0,
  );
  const quotaPercent = percent(spent, planned);
  return (
    <>
      <section className="top-cards">
        <TileButton
          onClick={() => open("timer")}
          icon="◷"
          label="Daily quota"
          value={`${quotaPercent}%`}
          detail={`${day.focusHeads.length} focus timers`}
          progress={quotaPercent}
        />
        <TileButton
          onClick={() => open("tasks")}
          icon="☑"
          label="Tasks complete"
          value={`${taskPercent}%`}
          detail={`${doneTasks} of ${day.tasks.length} done`}
          progress={taskPercent}
        />
        <TileButton
          onClick={() => open("habits")}
          icon="✓"
          label="Habits complete"
          value={`${habitPercent}%`}
          detail={`${doneHabits} of ${settings.habits.length} complete`}
          progress={habitPercent}
        />
      </section>
      <section className="dash-grid">
        <PanelLink
          className="today-panel"
          title="Today"
          action="Open tasks"
          onClick={() => open("tasks")}
        >
          <div className="date-row">
            <label className="date-picker">
              Viewing{" "}
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          </div>
          <div className="schedule">
            {day.tasks.length ? (
              day.tasks.slice(0, 5).map((task) => (
                <div className="schedule-row" key={task.id}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() =>
                      setDay((current) => ({
                        ...current,
                        tasks: current.tasks.map((item) =>
                          item.id === task.id
                            ? { ...item, done: !item.done }
                            : item,
                        ),
                      }))
                    }
                  />
                  <span>{task.text}</span>
                  <small>{task.reminder || "Anytime"}</small>
                </div>
              ))
            ) : (
              <Empty text="Add your first task" onClick={() => open("tasks")} />
            )}
          </div>
        </PanelLink>
        <div className="stack">
          <PanelLink
            title="Goals"
            action="View all goals"
            onClick={() => open("goals")}
          >
            {settings.goals.slice(0, 3).map((goal) => (
              <div className="goal-line" key={goal.id}>
                <div>
                  <b>{goal.name}</b>
                  <span>
                    {percent(goal.current, goal.target)}% · {goal.current} /{" "}
                    {goal.target} {goal.unit}
                  </span>
                </div>
                <Progress
                  value={percent(goal.current, goal.target)}
                  color={goal.color}
                />
              </div>
            ))}
          </PanelLink>
          <PanelLink
            title="Habits"
            action="Track habits"
            onClick={() => open("habits")}
          >
            <div className="dashboard-habits">
              {settings.habits.map((habit) => (
                <button
                  className="habit-row"
                  key={habit.id}
                  onClick={() =>
                    setDay((current) => ({
                      ...current,
                      habitDone: {
                        ...current.habitDone,
                        [habit.id]: !current.habitDone[habit.id],
                      },
                    }))
                  }
                >
                  <span
                    className={
                      day.habitDone[habit.id]
                        ? "habit-check yes"
                        : "habit-check"
                    }
                  >
                    {day.habitDone[habit.id] ? "✓" : ""}
                  </span>
                  {habit.name}
                </button>
              ))}
            </div>
          </PanelLink>
          <PanelLink
            title="Journal"
            action="Write a note"
            onClick={() => open("journal")}
          >
            <textarea
              className="quick-note"
              value={day.notes}
              onChange={(event) =>
                setDay((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="What's on your mind today?"
            />
          </PanelLink>
        </div>
      </section>
      <section className="dashboard-secondary">
        <section className="topic-dashboard panel">
          <div>
            <h2>Topic notes & links</h2>
            <p>Search your knowledge base, or capture a new thought.</p>
          </div>
          <input
            placeholder="Search or add a topic..."
            onKeyDown={(event) => {
              if (event.key === "Enter") open("topics");
            }}
          />
          <button onClick={() => open("topics")}>Search / Add / Edit →</button>
        </section>
        <section className="focus-summary panel">
          <div className="panel-top">
            <h2>Time spent by topic</h2>
            <button onClick={() => open("timer")}>Open focus →</button>
          </div>
          {day.focusHeads.length ? (
            <div className="topic-summary-list">
              {day.focusHeads.map((head) => (
                <button key={head.id} onClick={() => open("timer")}>
                  <span>{head.name}</span>
                  <b>{clock(head.elapsedSeconds)}</b>
                  <Progress
                    value={percent(head.elapsedSeconds, head.targetSeconds)}
                    color="green"
                  />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              text="Add Python, JS, or another topic"
              onClick={() => open("timer")}
            />
          )}
        </section>
      </section>
      <section className="section-heading">
        <h2>Explore your life</h2>
        <p>Every tile opens a dedicated detail page.</p>
      </section>
      <div className="life-tiles">
        <LifeTile
          icon="⌘"
          title="Learning"
          text="Python, JS, TS, React and more"
          onClick={() => open("learning")}
        />
        <LifeTile
          icon="◉"
          title="Movies"
          text={`${day.movies.length} logged today`}
          onClick={() => open("movies")}
        />
        <LifeTile
          icon="✦"
          title="Ideas"
          text="Capture what flows in"
          onClick={() => open("ideas")}
        />
        <LifeTile
          icon="◷"
          title="Focus"
          text="Stopwatch and topic timers"
          onClick={() => open("timer")}
        />
      </div>
    </>
  );
}
