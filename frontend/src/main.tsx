import React from 'react';
import ReactDOM from 'react-dom/client';
import { format, parseISO } from 'date-fns';
import {
  Activity,
  BarChart3,
  Calendar,
  Database,
  Download,
  Flame,
  LineChart,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import './styles.css';

type Exercise = {
  id: string;
  name: string;
  loadKg: number;
  loadLabel: string;
  reps: number[];
  note?: string;
};

type Session = {
  id: string;
  date: string;
  location: string;
  restSeconds: number;
  exercises: Exercise[];
};

type ExerciseForm = Omit<Exercise, 'id' | 'loadKg' | 'reps'> & {
  loadKg: string;
  newName: string;
  reps: string;
};

const STORAGE_KEY = 'gym-tracker.sessions.v1';
const CUSTOM_EXERCISES_KEY = 'gym-tracker.custom-exercises.v1';
const PASSCODE_HASH_KEY = 'gym-tracker.passcode-hash.v1';
const UNLOCKED_SESSION_KEY = 'gym-tracker.unlocked-session.v1';
const NEW_EXERCISE_VALUE = '__new_exercise__';

const seedSessions: Session[] = [
  {
    id: '2026-05-25',
    date: '2026-05-25',
    location: 'Gym',
    restSeconds: 90,
    exercises: [
      {
        id: 'bench-2026-05-25',
        name: 'Bench press',
        loadKg: 20,
        loadLabel: '2x10kg plates',
        reps: [8, 7, 6],
      },
      {
        id: 'french-press-2026-05-25',
        name: 'French press',
        loadKg: 8,
        loadLabel: '2x4kg dumbbells',
        reps: [5, 4, 3],
        note: 'links',
      },
      {
        id: 'rows-2026-05-25',
        name: 'Sitting rows',
        loadKg: 40,
        loadLabel: 'machine 2x20kg',
        reps: [8, 8, 8],
      },
      {
        id: 'split-squats-2026-05-25',
        name: 'Split squats',
        loadKg: 12,
        loadLabel: '12kg kettlebell',
        reps: [8, 6],
      },
      {
        id: 'single-leg-rdl-2026-05-25',
        name: 'Single-leg RDL',
        loadKg: 12,
        loadLabel: '12kg kettlebell',
        reps: [8, 8],
      },
      {
        id: 'hanging-leg-raises-2026-05-25',
        name: 'Hanging leg raises',
        loadKg: 0,
        loadLabel: 'bodyweight',
        reps: [7, 6, 5],
      },
    ],
  },
];

const starterExercise: ExerciseForm = {
  name: 'Bench press',
  loadKg: '20',
  loadLabel: '2x10kg plates',
  newName: '',
  reps: '8,7,6',
  note: '',
};

const palette = ['#2563eb', '#0891b2', '#f97316', '#7c3aed', '#16a34a', '#dc2626', '#9333ea', '#0f766e'];

function loadSessions(): Session[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return seedSessions;

  try {
    const parsed = JSON.parse(stored) as Session[];
    return parsed.length > 0 ? parsed : seedSessions;
  } catch {
    return seedSessions;
  }
}

function saveSessions(sessions: Session[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function loadCustomExercises(): string[] {
  const stored = localStorage.getItem(CUSTOM_EXERCISES_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveCustomExercises(exercises: string[]) {
  localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
}

async function hashPasscode(passcode: string) {
  const bytes = new TextEncoder().encode(passcode);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseReps(value: string): number[] {
  return value
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function sessionVolume(session: Session) {
  return session.exercises.reduce((sum, exercise) => sum + exercise.loadKg * totalReps(exercise), 0);
}

function totalReps(exercise: Exercise) {
  return exercise.reps.reduce((sum, reps) => sum + reps, 0);
}

function topSet(exercise: Exercise) {
  return exercise.reps.length ? Math.max(...exercise.reps) : 0;
}

function estimatedOneRepMax(exercise: Exercise) {
  if (exercise.loadKg <= 0) return topSet(exercise);
  return Math.round(exercise.loadKg * (1 + topSet(exercise) / 30) * 10) / 10;
}

function formatRest(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')} min`;
}

function uniqueExerciseNames(sessions: Session[]) {
  return Array.from(new Set(sessions.flatMap((session) => session.exercises.map((exercise) => exercise.name)))).sort();
}

function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function exerciseNameForForm(exercise: ExerciseForm) {
  return normalizeExerciseName(exercise.name === NEW_EXERCISE_VALUE ? exercise.newName : exercise.name);
}

function pointsForExercise(sessions: Session[], name: string, metric: 'volume' | 'reps' | 'e1rm') {
  return sessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((session) =>
      session.exercises
        .filter((exercise) => exercise.name === name)
        .map((exercise) => ({
          date: session.date,
          value:
            metric === 'volume'
              ? exercise.loadKg * totalReps(exercise)
              : metric === 'e1rm'
                ? estimatedOneRepMax(exercise)
                : totalReps(exercise),
        })),
    );
}

function Sparkline({
  data,
  color = '#2563eb',
  height = 54,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const width = 180;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const coords = data.map((value, index) => {
    const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="trend sparkline">
      <polyline fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={coords.join(' ')} />
      {coords.map((coord, index) => {
        const [x, y] = coord.split(',').map(Number);
        return <circle key={index} cx={x} cy={y} r="3.5" fill={color} />;
      })}
    </svg>
  );
}

function LinePlot({
  title,
  subtitle,
  series,
  suffix = '',
}: {
  title: string;
  subtitle: string;
  series: { label: string; color: string; points: { date: string; value: number }[] }[];
  suffix?: string;
}) {
  const width = 720;
  const height = 310;
  const pad = { top: 28, right: 28, bottom: 58, left: 64 };
  const dates = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.date)))).sort();
  const values = series.flatMap((item) => item.points.map((point) => point.value));
  const max = Math.max(...values, 1);
  const yMax = Math.ceil(max * 1.15);
  const xForDate = (date: string) => {
    const index = dates.indexOf(date);
    return dates.length <= 1 ? width / 2 : pad.left + (index / (dates.length - 1)) * (width - pad.left - pad.right);
  };
  const yForValue = (value: number) => height - pad.bottom - (value / yMax) * (height - pad.top - pad.bottom);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((part) => Math.round(yMax * part));

  return (
    <section className="plot-card">
      <div className="plot-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <LineChart size={20} />
      </div>
      <div className="plot-frame">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={yForValue(tick)} y2={yForValue(tick)} className="grid-line" />
              <text x={pad.left - 12} y={yForValue(tick) + 4} textAnchor="end" className="axis-label">
                {tick}
                {suffix}
              </text>
            </g>
          ))}
          {dates.map((date) => (
            <text key={date} x={xForDate(date)} y={height - 22} textAnchor="middle" className="axis-label">
              {format(parseISO(date), 'dd.MM')}
            </text>
          ))}
          {series.map((item) => {
            const coords = item.points.map((point) => `${xForDate(point.date)},${yForValue(point.value)}`).join(' ');
            return (
              <g key={item.label}>
                <polyline points={coords} fill="none" stroke={item.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                {item.points.map((point) => (
                  <circle key={`${item.label}-${point.date}-${point.value}`} cx={xForDate(point.date)} cy={yForValue(point.value)} r="5" fill={item.color}>
                    <title>{`${item.label}: ${point.value}${suffix} on ${format(parseISO(point.date), 'dd.MM.yyyy')}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="legend">
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function BarPlot({ sessions }: { sessions: Session[] }) {
  const data = sessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => ({
      label: format(parseISO(session.date), 'dd.MM'),
      volume: sessionVolume(session),
      sets: session.exercises.reduce((sum, exercise) => sum + exercise.reps.length, 0),
    }));
  const max = Math.max(...data.map((item) => item.volume), 1);

  return (
    <section className="plot-card">
      <div className="plot-heading">
        <div>
          <h2>Session Volume</h2>
          <p>Load x reps per workout, with sets shown inside each bar.</p>
        </div>
        <BarChart3 size={20} />
      </div>
      <div className="bars">
        {data.map((item) => (
          <div className="bar-column" key={item.label}>
            <div className="bar-track">
              <div className="bar-fill" style={{ height: `${Math.max((item.volume / max) * 100, 4)}%` }}>
                <span>{item.sets}</span>
              </div>
            </div>
            <strong>{item.volume}</strong>
            <small>{item.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExerciseTable({ sessions, onDeleteSession }: { sessions: Session[]; onDeleteSession: (id: string) => void }) {
  return (
    <section className="table-card">
      <div className="plot-heading">
        <div>
          <h2>Training Log</h2>
          <p>All sets are stored as rep arrays, so 8,7,6 means three sets.</p>
        </div>
        <Database size={20} />
      </div>
      <div className="session-list">
        {sessions
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((session) => (
            <article className="session-card" key={session.id}>
              <header>
                <div>
                  <strong>{format(parseISO(session.date), 'dd.MM.yyyy')}</strong>
                  <span>
                    {session.location} · {formatRest(session.restSeconds)} pause
                  </span>
                </div>
                <button className="icon-button" onClick={() => onDeleteSession(session.id)} aria-label="Delete session">
                  <Trash2 size={16} />
                </button>
              </header>
              <div className="exercise-grid">
                {session.exercises.map((exercise) => (
                  <div className="exercise-row" key={exercise.id}>
                    <span>{exercise.name}</span>
                    <span>{exercise.loadLabel}</span>
                    <strong>{exercise.reps.join(', ')}</strong>
                    <span>{exercise.loadKg > 0 ? `${exercise.loadKg * totalReps(exercise)} kg` : `${totalReps(exercise)} reps`}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}

function PasscodeGate({
  hasPasscode,
  onUnlock,
  onSetPasscode,
}: {
  hasPasscode: boolean;
  onUnlock: (passcode: string) => Promise<boolean>;
  onSetPasscode: (passcode: string) => Promise<void>;
}) {
  const [passcode, setPasscode] = React.useState('');
  const [confirmPasscode, setConfirmPasscode] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function submitPasscode(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (passcode.length < 4) {
      setError('Use at least 4 characters.');
      return;
    }

    if (!hasPasscode && passcode !== confirmPasscode) {
      setError('The passcodes do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (hasPasscode) {
        const isValid = await onUnlock(passcode);
        if (!isValid) {
          setError('Wrong passcode.');
          return;
        }
      } else {
        await onSetPasscode(passcode);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submitPasscode}>
        <span className="eyebrow">
          <ShieldCheck size={16} />
          Local passcode
        </span>
        <h1>{hasPasscode ? 'Unlock Gym Tracker' : 'Set a Passcode'}</h1>
        <p>
          Your workouts stay in this browser. The passcode blocks casual access on this device, but it is not a replacement for device security.
        </p>
        <label>
          Passcode
          <input
            autoFocus
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            autoComplete={hasPasscode ? 'current-password' : 'new-password'}
          />
        </label>
        {!hasPasscode && (
          <label>
            Confirm passcode
            <input
              type="password"
              value={confirmPasscode}
              onChange={(event) => setConfirmPasscode(event.target.value)}
              autoComplete="new-password"
            />
          </label>
        )}
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="primary-button wide" disabled={isSubmitting}>
          {hasPasscode ? 'Unlock' : 'Save passcode'}
        </button>
      </form>
    </main>
  );
}

function App() {
  const [passcodeHash, setPasscodeHash] = React.useState(() => localStorage.getItem(PASSCODE_HASH_KEY));
  const [isUnlocked, setIsUnlocked] = React.useState(() => sessionStorage.getItem(UNLOCKED_SESSION_KEY) === 'true');
  const [sessions, setSessions] = React.useState<Session[]>(loadSessions);
  const [customExercises, setCustomExercises] = React.useState<string[]>(loadCustomExercises);
  const [selectedExercise, setSelectedExercise] = React.useState('Bench press');
  const [sessionDate, setSessionDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [location, setLocation] = React.useState('Gym');
  const [restSeconds, setRestSeconds] = React.useState('90');
  const [exercises, setExercises] = React.useState<ExerciseForm[]>([starterExercise]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  React.useEffect(() => {
    saveCustomExercises(customExercises);
  }, [customExercises]);

  const exerciseNames = Array.from(new Set([...uniqueExerciseNames(sessions), ...customExercises])).sort();
  const selectedSeries = [
    {
      label: `${selectedExercise} volume`,
      color: '#2563eb',
      points: pointsForExercise(sessions, selectedExercise, 'volume'),
    },
  ];
  const strengthSeries = exerciseNames.slice(0, 6).map((name, index) => ({
    label: name,
    color: palette[index % palette.length],
    points: pointsForExercise(sessions, name, 'e1rm'),
  }));
  const totalVolume = sessions.reduce((sum, session) => sum + sessionVolume(session), 0);
  const totalSets = sessions.reduce((sum, session) => sum + session.exercises.reduce((inner, exercise) => inner + exercise.reps.length, 0), 0);
  const latestSession = sessions.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const weeklyFrequency = sessions.length > 1 ? Math.round((sessions.length / 4) * 10) / 10 : sessions.length;

  async function unlock(passcode: string) {
    if (!passcodeHash) return false;
    const candidateHash = await hashPasscode(passcode);
    const isValid = candidateHash === passcodeHash;
    if (isValid) {
      sessionStorage.setItem(UNLOCKED_SESSION_KEY, 'true');
      setIsUnlocked(true);
    }
    return isValid;
  }

  async function setPasscode(passcode: string) {
    const nextHash = await hashPasscode(passcode);
    localStorage.setItem(PASSCODE_HASH_KEY, nextHash);
    sessionStorage.setItem(UNLOCKED_SESSION_KEY, 'true');
    setPasscodeHash(nextHash);
    setIsUnlocked(true);
  }

  function lockApp() {
    sessionStorage.removeItem(UNLOCKED_SESSION_KEY);
    setIsUnlocked(false);
  }

  function updateExercise(index: number, patch: Partial<ExerciseForm>) {
    setExercises((current) => current.map((exercise, currentIndex) => (currentIndex === index ? { ...exercise, ...patch } : exercise)));
  }

  function addExercise() {
    setExercises((current) => [...current, { ...starterExercise, name: '', newName: '', loadKg: '', loadLabel: '', reps: '', note: '' }]);
  }

  function removeExercise(index: number) {
    setExercises((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function addSession(event: React.FormEvent) {
    event.preventDefault();
    const nextCustomExercises = new Set(customExercises);
    const parsedExercises: Exercise[] = exercises
      .map((exercise, index) => {
        const name = exerciseNameForForm(exercise);
        if (exercise.name === NEW_EXERCISE_VALUE && name) {
          nextCustomExercises.add(name);
        }

        return {
          id: `${sessionDate}-${name || 'exercise'}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name,
          loadKg: Number(exercise.loadKg || 0),
          loadLabel: exercise.loadLabel.trim() || `${exercise.loadKg || 0}kg`,
          reps: parseReps(exercise.reps),
          note: exercise.note?.trim(),
        };
      })
      .filter((exercise) => exercise.name && exercise.reps.length > 0 && Number.isFinite(exercise.loadKg));

    if (!parsedExercises.length) return;

    const nextSession: Session = {
      id: `${sessionDate}-${Date.now()}`,
      date: sessionDate,
      location: location.trim() || 'Gym',
      restSeconds: Number(restSeconds) || 90,
      exercises: parsedExercises,
    };

    setSessions((current) => [...current, nextSession]);
    setCustomExercises(Array.from(nextCustomExercises).sort());
    setExercises([{ ...starterExercise, name: '', newName: '', loadKg: '', loadLabel: '', reps: '', note: '' }]);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-tracker-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Session[];
        if (Array.isArray(parsed)) setSessions(parsed);
      } catch {
        window.alert('Could not import this JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  if (!passcodeHash || !isUnlocked) {
    return <PasscodeGate hasPasscode={Boolean(passcodeHash)} onUnlock={unlock} onSetPasscode={setPasscode} />;
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <span className="eyebrow">
            <Activity size={16} />
            GitHub Pages strength analytics
          </span>
          <h1>Gym Tracker</h1>
          <p>
            A small, local-first training lab for logging set-level reps and watching strength, volume, and consistency move over time.
          </p>
        </div>
        <div className="hero-panel">
          <Sparkline data={sessions.map(sessionVolume)} color="#67e8f9" height={78} />
          <span>Current signal</span>
          <strong>{totalVolume.toLocaleString()} kg total logged volume</strong>
        </div>
      </section>

      <section className="metric-grid">
        <article>
          <Calendar size={18} />
          <span>Sessions</span>
          <strong>{sessions.length}</strong>
        </article>
        <article>
          <Flame size={18} />
          <span>Weekly target</span>
          <strong>{weeklyFrequency >= 2 ? 'On track' : '2x/week'}</strong>
        </article>
        <article>
          <BarChart3 size={18} />
          <span>Sets logged</span>
          <strong>{totalSets}</strong>
        </article>
        <article>
          <Activity size={18} />
          <span>Last workout</span>
          <strong>{latestSession ? format(parseISO(latestSession.date), 'dd.MM') : 'None'}</strong>
        </article>
      </section>

      <section className="workspace">
        <form className="log-panel" onSubmit={addSession}>
          <div className="panel-heading">
            <div>
              <h2>Log Workout</h2>
              <p>Comma-separated reps become set arrays: 8,7,6.</p>
            </div>
            <Save size={20} />
          </div>
          <div className="form-grid">
            <label>
              Date
              <input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
            </label>
            <label>
              Location
              <input value={location} onChange={(event) => setLocation(event.target.value)} />
            </label>
            <label>
              Pause (seconds)
              <input inputMode="numeric" value={restSeconds} onChange={(event) => setRestSeconds(event.target.value)} />
            </label>
          </div>

          <div className="exercise-form-list">
            {exercises.map((exercise, index) => (
              <div className="exercise-form" key={index}>
                <label>
                  Exercise
                  <div className="exercise-name-fields">
                    <select value={exercise.name} onChange={(event) => updateExercise(index, { name: event.target.value, newName: '' })}>
                      <option value="">Choose exercise</option>
                      {exerciseNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                      <option value={NEW_EXERCISE_VALUE}>+ Add new exercise</option>
                    </select>
                    {exercise.name === NEW_EXERCISE_VALUE && (
                      <input
                        aria-label="New exercise name"
                        value={exercise.newName}
                        onChange={(event) => updateExercise(index, { newName: event.target.value })}
                        placeholder="New exercise name"
                      />
                    )}
                  </div>
                </label>
                <label>
                  Load kg
                  <input inputMode="decimal" value={exercise.loadKg} onChange={(event) => updateExercise(index, { loadKg: event.target.value })} />
                </label>
                <label>
                  Setup
                  <input value={exercise.loadLabel} onChange={(event) => updateExercise(index, { loadLabel: event.target.value })} />
                </label>
                <label>
                  Reps
                  <input value={exercise.reps} onChange={(event) => updateExercise(index, { reps: event.target.value })} placeholder="8,7,6" />
                </label>
                <button className="icon-button remove" type="button" onClick={() => removeExercise(index)} aria-label="Remove exercise">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={addExercise}>
              <Plus size={16} />
              Add exercise
            </button>
            <button type="submit" className="primary-button">
              Save session
            </button>
          </div>
        </form>

        <aside className="controls-panel">
          <div className="panel-heading">
            <div>
              <h2>Analysis Controls</h2>
              <p>Pick an exercise and keep your raw data portable.</p>
            </div>
          </div>
          <label>
            Exercise trend
            <select value={selectedExercise} onChange={(event) => setSelectedExercise(event.target.value)}>
              {exerciseNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button wide" onClick={exportData}>
            <Download size={16} />
            Export JSON
          </button>
          <button className="secondary-button wide" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            Import JSON
          </button>
          <button className="secondary-button wide" onClick={lockApp}>
            <Lock size={16} />
            Lock app
          </button>
          <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json" onChange={importData} />
        </aside>
      </section>

      <section className="plot-grid">
        <BarPlot sessions={sessions} />
        <LinePlot title="Selected Exercise Volume" subtitle="A focused view for the lift you are debugging." series={selectedSeries} suffix="kg" />
        <LinePlot title="Estimated Strength Index" subtitle="Epley estimate for loaded lifts; top reps for bodyweight movements." series={strengthSeries} />
      </section>

      <ExerciseTable sessions={sessions} onDeleteSession={(id) => setSessions((current) => current.filter((session) => session.id !== id))} />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
