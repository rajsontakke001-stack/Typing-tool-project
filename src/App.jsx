import { useState, useEffect, useRef, useMemo } from "react";
import RGBKeyboard from "./RGBKeyboard.jsx";
import "./App.css";

/* ================================= DATA ================================= */

const EXERCISES = [
  { id: "home", name: "Home Row", level: "Beginner", icon: "asdf", desc: "a s d f  ·  j k l ;" },
  { id: "top", name: "Top Row", level: "Beginner", icon: "qwer", desc: "q w e r t  ·  y u i o p" },
  { id: "bottom", name: "Bottom Row", level: "Intermediate", icon: "zxcv", desc: "z x c v b  ·  n m , . /" },
  { id: "numbers", name: "Numbers", level: "Intermediate", icon: "123", desc: "Digits, dates and decimals" },
  { id: "symbols", name: "Symbols", level: "Advanced", icon: "@#", desc: "Punctuation and shift keys" },
  { id: "words", name: "Common Words", level: "Intermediate", icon: "Aa", desc: "Everyday vocabulary" },
  { id: "sentences", name: "Sentences", level: "Advanced", icon: "¶", desc: "Full sentences with rhythm" },
  { id: "code", name: "Code Typing", level: "Advanced", icon: "</>", desc: "Brackets and syntax" },
  { id: "smart", name: "Smart Drill", level: "Adaptive", icon: "✦", desc: "Built from the keys you miss" },
];

const PHRASES = {
  home: [
    "asdf jkl; asdf jkl;",
    "a sad lad had a dad",
    "all fall flask salad",
    "dad asks a lad a flask",
    "gas glad shall sad fall",
    "ask dad; flash a lad;",
  ],
  top: [
    "qwer uiop qwer uiop",
    "your power quite tower",
    "try to write poetry",
    "pewter quote port tour",
    "we were tire out the query",
  ],
  bottom: [
    "zxcv bnm, zxcv bnm,",
    "zebra box can mix",
    "vex my cozy banana cave",
    "combine bmx vibe maze",
  ],
  numbers: [
    "1234 5678 90",
    "2024 1999 365 42",
    "101 202 303 404 505",
    "3.14 2.71 1.618 0.577",
    "7 8 9 0 1 2 3 4 5 6",
  ],
  symbols: [
    "(a + b) * c; x = y - z;",
    "@user #tag $100 50% &co",
    "[ok] {yes} <no> | ~ `tick`",
    "wait! what? yes, no... ok.",
    "\"quoted\" 'single' & more!",
  ],
  words: [
    "the quick brown fox jumps over the lazy dog",
    "practice makes a person perfect",
    "small steps every single day add up",
    "focus on accuracy before you chase speed",
    "keep your back straight and relax your hands",
  ],
  sentences: [
    "Typing is a skill that improves with steady daily practice.",
    "Good typists look at the screen, not at their fingers.",
    "Consistency beats bursts of speed over the long run.",
    "Every mistake is a clue about what to practise next.",
    "I am Sushil, and I am improving my typing every single day.",
  ],
  code: [
    "const sum = (a, b) => a + b;",
    "if (x >= 10 && y !== 0) { run(); }",
    "function greet(name) { return `Hi ${name}`; }",
    "for (let i = 0; i < n; i++) { total += i; }",
    "const user = { id: 1, name: \"Sushil\" };",
  ],
};

const WORD_BANK = [
  "the", "and", "with", "that", "have", "this", "from", "they", "know", "want",
  "good", "much", "some", "time", "very", "when", "come", "here", "just", "like",
  "make", "many", "over", "such", "take", "than", "them", "well", "also", "back",
  "find", "home", "more", "work", "first", "water", "right", "think", "where", "great",
  "should", "through", "before", "little", "friend", "keyboard", "practice", "typing",
  "speed", "accuracy", "focus", "steady", "pattern", "finger", "letter", "record",
  "future", "quality", "rhythm", "posture",
];

const TIME_LIMITS = [
  { label: "30 s", value: 30 },
  { label: "60 s", value: 60 },
  { label: "Full text", value: 0 },
];

const KEY_ROWS = ["1234567890", "qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];

const TONES = { warn: "#ffd23f", info: "#00f0ff", good: "#b6ff3b", tip: "#ff2bd6" };

const HISTORY_KEY = "typing-tool-history-v1";
const HISTORY_LIMIT = 30;
const TEXT_LENGTH = 240;

/* ================================ HELPERS ================================ */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const round = (v, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
const formatTime = (sec) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const keyName = (k) => (k === " " ? "space" : k);

const freshSession = () => ({
  status: "idle", // idle | running | done
  typed: "",
  keystrokes: 0,
  errors: 0,
  backspaces: 0,
  errorKeys: {}, // expected key -> number of misses
  confusions: {}, // JSON [typed, expected] -> count
  times: [], // timestamp of every keystroke
  startAt: 0,
  endAt: 0,
});

function buildText(pool, target = TEXT_LENGTH) {
  const parts = [];
  let len = 0;
  while (len < target) {
    const p = pick(pool);
    parts.push(p);
    len += p.length + 1;
  }
  return parts.join(" ");
}

function topKeys(counts, n) {
  return Object.entries(counts)
    .filter(([k, v]) => k.trim() && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function buildSmartDrill(errorKeys) {
  const weak = topKeys(errorKeys, 3);
  if (weak.length === 0) return buildText(WORD_BANK);
  const matches = WORD_BANK.filter((w) => weak.some((k) => w.includes(k)));
  const words = matches.length ? matches : WORD_BANK;
  const head = weak.map((k) => k.repeat(3)).join(" ");
  return `${head} ${buildText(words, 220)}`;
}

function generateText(id, errorKeys) {
  if (id === "smart") return buildSmartDrill(errorKeys);
  return buildText(PHRASES[id]);
}

function aggregateErrors(list) {
  const total = {};
  list.forEach((h) =>
    Object.entries(h.errorKeys || {}).forEach(([k, v]) => {
      total[k] = (total[k] || 0) + v;
    })
  );
  return total;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: history simply won't persist */
  }
}

/* Turns raw keystroke data into speed, accuracy and consistency figures. */
function computeMetrics(s, endAt) {
  const elapsed = Math.max((endAt - s.startAt) / 1000, 1);
  const minutes = elapsed / 60;
  const accuracy = s.keystrokes ? ((s.keystrokes - s.errors) / s.keystrokes) * 100 : 0;
  const gross = s.keystrokes / 5 / minutes; // standard: 5 characters = 1 word
  const net = Math.max(0, gross - s.errors / minutes);

  // keystrokes per 5-second window -> WPM for that window
  const buckets = new Array(Math.max(1, Math.ceil(elapsed / 5))).fill(0);
  s.times.forEach((t) => {
    const i = Math.min(buckets.length - 1, Math.floor((t - s.startAt) / 5000));
    buckets[i] += 1;
  });
  const full = buckets.slice(0, Math.floor(elapsed / 5)).map((c) => c * 2.4);

  let consistency = null;
  if (full.length >= 2) {
    const mean = full.reduce((a, b) => a + b, 0) / full.length;
    if (mean === 0) {
      consistency = 0;
    } else {
      const sd = Math.sqrt(full.reduce((a, b) => a + (b - mean) ** 2, 0) / full.length);
      consistency = Math.max(0, Math.min(100, 100 - (sd / mean) * 100));
    }
  }

  const c = consistency ?? 70;
  const score = Math.round(accuracy * 0.5 + Math.min(net / 80, 1) * 30 + c * 0.2);

  return {
    elapsed,
    accuracy,
    gross,
    net,
    consistency,
    series: full.length ? full : [net],
    keystrokes: s.keystrokes,
    errors: s.errors,
    backspaces: s.backspaces,
    score,
  };
}

function recommendNext(m, errorKeys) {
  if (topKeys(errorKeys, 1).length && m.accuracy < 95) return "smart";
  if (m.net < 25) return "home";
  if (m.accuracy >= 95 && m.net >= 45) return "sentences";
  return "words";
}

function buildSuggestions(m, errorKeys, confusions) {
  const out = [];
  const acc = round(m.accuracy);
  const net = round(m.net);

  if (acc < 85) {
    out.push({
      tone: "warn",
      title: "Slow down for accuracy",
      text: `Accuracy is ${acc}%. Type at a steady pace and aim for clean keystrokes before adding speed.`,
    });
  } else if (acc >= 96) {
    out.push({
      tone: "good",
      title: "Excellent control",
      text: `${acc}% accuracy is strong. You are ready for harder material such as Code Typing.`,
    });
  }

  if (net < 25) {
    out.push({
      tone: "warn",
      title: "Build your speed base",
      text: `${net} WPM is a solid starting point. Spend 10 minutes a day on Home Row to build muscle memory.`,
    });
  } else if (net < 45) {
    out.push({
      tone: "info",
      title: "Good base speed",
      text: `${net} WPM. Sentence practice will help you keep rhythm while you push for more speed.`,
    });
  } else {
    out.push({
      tone: "good",
      title: "Fast typing",
      text: `${net} WPM is above average. Now focus on holding the same pace from start to finish.`,
    });
  }

  if (m.consistency !== null && m.consistency < 60) {
    out.push({
      tone: "warn",
      title: "Uneven rhythm",
      text: `Consistency is ${round(m.consistency)}%. Your speed jumps between bursts and pauses. Try an even, steady pace.`,
    });
  }

  const weak = topKeys(errorKeys, 3);
  if (weak.length) {
    out.push({
      tone: "warn",
      title: "Weak keys detected",
      text: `You missed ${weak.map((k) => `"${keyName(k)}"`).join(", ")} most often. Use Smart Drill to practise them.`,
    });
  }

  const top = Object.entries(confusions).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) {
    const [typedKey, expected] = JSON.parse(top[0]);
    const shiftIssue = typedKey.toLowerCase() === expected.toLowerCase();
    out.push({
      tone: "info",
      title: shiftIssue ? "Shift timing" : "Common mix-up",
      text: shiftIssue
        ? `You typed "${typedKey}" instead of "${expected}" ${top[1]} times. Hold Shift with the opposite hand before pressing the letter.`
        : `You pressed "${keyName(typedKey)}" when you meant "${keyName(expected)}" ${top[1]} times. Check finger placement for both keys.`,
    });
  }

  if (m.keystrokes > 20 && m.backspaces > m.keystrokes * 0.15) {
    out.push({
      tone: "info",
      title: "Too many corrections",
      text: `You used Backspace ${m.backspaces} times. A short pause before each word can cut down on corrections.`,
    });
  }

  const trimmed = out.slice(0, 4);
  trimmed.push({
    tone: "tip",
    title: "Posture tip",
    text: "Keep your eyes on the screen, wrists relaxed, and return your fingers to the home row after every key.",
  });
  return trimmed;
}

function getGrade(score) {
  if (score >= 90) return { letter: "S", label: "Outstanding", color: "#b6ff3b" };
  if (score >= 75) return { letter: "A", label: "Great", color: "#00f0ff" };
  if (score >= 60) return { letter: "B", label: "Good", color: "#ffd23f" };
  if (score >= 40) return { letter: "C", label: "Keep going", color: "#ff9f1c" };
  return { letter: "D", label: "Practise more", color: "#ff4d6d" };
}

/* ============================= UI COMPONENTS ============================= */

function TypingText({ target, typed }) {
  return (
    <div className="tt-text">
      {target.split("").map((ch, i) => {
        let cls = "ch";
        if (i < typed.length) cls += typed[i] === ch ? " ok" : " bad";
        else if (i === typed.length) cls += " caret";
        return (
          <span key={i} className={cls}>
            {ch}
          </span>
        );
      })}
    </div>
  );
}

function Ring({ value, text, label, color }) {
  const p = Math.max(0, Math.min(100, value));
  return (
    <div className="ring" style={{ "--p": p, "--ring": color }}>
      <div className="ring-inner">
        <strong>{text}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function Tile({ label, value, unit, tone }) {
  return (
    <div className="tile" style={{ "--tone": tone }}>
      <span>{label}</span>
      <strong>
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
    </div>
  );
}

function Sparkline({ values, id, color, height = 120 }) {
  if (!values || values.length < 2) {
    return <div className="empty-chart">Type a little longer to see the trend.</div>;
  }
  const width = 400;
  const max = Math.max(20, ...values) * 1.15;
  const line = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - (v / max) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Speed trend chart"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Heatmap({ counts }) {
  const max = Math.max(1, ...Object.values(counts));
  const layout = new Set(KEY_ROWS.join(""));
  const extras = Object.entries(counts).filter(([k]) => k !== " " && !layout.has(k));
  const spaceCount = counts[" "] || 0;

  return (
    <div className="heat">
      {KEY_ROWS.map((row) => (
        <div className="heat-row" key={row}>
          {row.split("").map((k) => {
            const c = counts[k] || 0;
            return (
              <div
                key={k}
                className={`heat-key ${c ? "hot" : ""}`}
                style={{ "--h": c / max }}
                title={`${k}: ${c} misses`}
              >
                <span>{k}</span>
                {c > 0 ? <small>{c}</small> : null}
              </div>
            );
          })}
        </div>
      ))}
      <div className="heat-space">
        <div className={`heat-key space ${spaceCount ? "hot" : ""}`} style={{ "--h": spaceCount / max }}>
          <span>space</span>
          {spaceCount > 0 ? <small>{spaceCount}</small> : null}
        </div>
      </div>
      {extras.length > 0 ? (
        <p className="heat-extra">
          Other keys: {extras.map(([k, c]) => `${keyName(k)} ×${c}`).join("  ·  ")}
        </p>
      ) : null}
    </div>
  );
}

function ReportPanel({ r, onRetry, onNext, onSmart }) {
  const grade = getGrade(r.score);
  const nextName = EXERCISES.find((e) => e.id === r.nextId)?.name;

  return (
    <section className="tt-card tt-report">
      <div className="tt-report-head">
        <div>
          <h2>Analytical Report</h2>
          <p>
            {r.exerciseName} · {r.keystrokes} keystrokes · {formatTime(r.elapsed)} · Score {r.score}/100
          </p>
        </div>
        <div className="grade" style={{ "--g": grade.color }}>
          {grade.letter}
          <small>{grade.label}</small>
        </div>
      </div>

      <div className="metric-grid">
        <Tile label="Net speed" value={round(r.net)} unit="WPM" tone="var(--cyan)" />
        <Tile label="Gross speed" value={round(r.gross)} unit="WPM" tone="var(--magenta)" />
        <Tile label="Accuracy" value={round(r.accuracy, 1)} unit="%" tone="var(--lime)" />
        <Tile
          label="Consistency"
          value={r.consistency === null ? "—" : round(r.consistency)}
          unit={r.consistency === null ? "" : "%"}
          tone="var(--amber)"
        />
        <Tile label="Errors" value={r.errors} tone="var(--red)" />
        <Tile label="Corrections" value={r.backspaces} tone="var(--cyan)" />
      </div>

      <div className="report-cols">
        <div className="sub-card">
          <h4>Speed over time (WPM per 5 s)</h4>
          <Sparkline values={r.series} id="report-fill" color="#00f0ff" height={140} />
        </div>
        <div className="sub-card">
          <h4>Error heatmap</h4>
          <Heatmap counts={r.errorKeys} />
        </div>
      </div>

      <div className="sub-card">
        <h4>Suggestions</h4>
        <ul className="sugg">
          {r.suggestions.map((s, i) => (
            <li key={i} style={{ "--tone": TONES[s.tone] }}>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="report-actions">
        <button type="button" className="tt-btn" onClick={onRetry}>
          Retry this text
        </button>
        <button type="button" className="tt-btn primary" onClick={onSmart}>
          Smart Drill
        </button>
        <button type="button" className="tt-btn" onClick={onNext}>
          Next: {nextName}
        </button>
      </div>
    </section>
  );
}

/* ================================== APP ================================== */

export default function App() {
  const [history, setHistory] = useState(loadHistory);
  const aggregate = useMemo(() => aggregateErrors(history), [history]);

  const [exerciseId, setExerciseId] = useState("home");
  const [limit, setLimit] = useState(60);
  const [text, setText] = useState(() => generateText("home", aggregate));
  const [session, setSession] = useState(freshSession);
  const [report, setReport] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const padRef = useRef(null);
  const sessionRef = useRef(session);
  const finishRef = useRef(null);
  sessionRef.current = session;

  const exercise = EXERCISES.find((e) => e.id === exerciseId);
  const running = session.status === "running";
  const done = session.status === "done";

  /* ---- finish a session: compute report and save to history ---- */
  const finish = (s, endAt) => {
    if (sessionRef.current.status === "done") return;
    const ended = { ...s, status: "done", endAt };
    const m = computeMetrics(ended, endAt);
    const nextId = recommendNext(m, ended.errorKeys);

    const entry = {
      at: new Date().toISOString(),
      exercise: exercise.name,
      net: round(m.net, 1),
      gross: round(m.gross, 1),
      accuracy: round(m.accuracy, 1),
      consistency: m.consistency === null ? null : round(m.consistency),
      score: m.score,
      errors: m.errors,
      errorKeys: ended.errorKeys,
      next: nextId,
    };
    const list = [...history, entry].slice(-HISTORY_LIMIT);
    setHistory(list);
    saveHistory(list);

    setSession(ended);
    setReport({
      ...m,
      exerciseName: exercise.name,
      nextId,
      errorKeys: ended.errorKeys,
      suggestions: buildSuggestions(m, ended.errorKeys, ended.confusions),
    });
  };
  finishRef.current = finish;

  /* ---- live clock + time-limit enforcement while running ---- */
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const s = sessionRef.current;
      if (limit > 0 && t - s.startAt >= limit * 1000) finishRef.current(s, t);
    }, 250);
    return () => clearInterval(id);
  }, [running, limit]);

  /* ---- keep the typing pad focused ---- */
  useEffect(() => {
    padRef.current?.focus();
  }, [text]);

  /* ---- keystroke handling ---- */
  const handleKey = (e) => {
    if (done || e.ctrlKey || e.metaKey || e.altKey) return;
    const isChar = e.key.length === 1;
    const isBack = e.key === "Backspace";
    if (!isChar && !isBack) return;
    e.preventDefault();

    if (isBack) {
      if (!running || session.typed.length === 0) return;
      setSession({
        ...session,
        typed: session.typed.slice(0, -1),
        backspaces: session.backspaces + 1,
      });
      return;
    }

    if (session.typed.length >= text.length) return;

    const t = Date.now();
    const base = running ? session : { ...freshSession(), status: "running", startAt: t };
    const expected = text[base.typed.length];
    const ok = e.key === expected;

    const errorKeys = { ...base.errorKeys };
    const confusions = { ...base.confusions };
    if (!ok) {
      const exp = expected.toLowerCase();
      errorKeys[exp] = (errorKeys[exp] || 0) + 1;
      const pair = JSON.stringify([e.key, expected]);
      confusions[pair] = (confusions[pair] || 0) + 1;
    }

    const next = {
      ...base,
      typed: base.typed + e.key,
      keystrokes: base.keystrokes + 1,
      errors: base.errors + (ok ? 0 : 1),
      errorKeys,
      confusions,
      times: [...base.times, t],
    };

    if (next.typed.length === text.length) {
      finish(next, t);
      return;
    }
    setSession(next);
  };

  /* ---- assignments and resets ---- */
  const newSession = () => {
    setSession(freshSession());
    setReport(null);
    padRef.current?.focus();
  };
  const selectExercise = (id) => {
    setExerciseId(id);
    setText(generateText(id, aggregate));
    newSession();
  };
  const newText = () => {
    setText(generateText(exerciseId, aggregate));
    newSession();
  };
  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  /* ---- derived values ---- */
  const live = session.keystrokes > 0 ? computeMetrics(session, done ? session.endAt : now) : null;
  const elapsedSec = live ? live.elapsed : 0;
  const timeShown = limit > 0 && !done ? Math.max(0, limit - elapsedSec) : elapsedSec;
  const progress = text.length ? (session.typed.length / text.length) * 100 : 0;
  const bestNet = history.length ? Math.max(...history.map((h) => h.net)) : 0;
  const avgAcc = history.length ? history.reduce((a, h) => a + h.accuracy, 0) / history.length : 0;
  const nextId = report ? report.nextId : history.length ? history[history.length - 1].next : "home";
  const nextEx = EXERCISES.find((e) => e.id === nextId);

  const expectedChar = done || session.typed.length >= text.length ? null : text[session.typed.length];

  const hint = done
    ? "Session complete. Your analytical report is below."
    : running
    ? "Keep going! Use Backspace to fix mistakes. Every key is tracked."
    : "Click the pad and start typing. The timer begins with your first key.";

  return (
    <div className="tt-app">
      <header className="tt-header">
        <div className="tt-brand">
          <div className="tt-logo">⌨</div>
          <div>
            <h1>Typing Enhancement Tool</h1>
            <p>Practise · Analyse · Improve</p>
          </div>
        </div>
        <div className="tt-header-pills">
          <span className="tt-pill">Sessions {history.length}</span>
          <span className="tt-pill">Best {round(bestNet)} WPM</span>
        </div>
      </header>

      <main className="tt-layout">
        <div className="tt-main">
          <section className="tt-card">
            <h2 className="tt-card-title">Tasks for keyboard typing</h2>
            <div className="tt-tasks">
              {EXERCISES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className={`tt-task ${ex.id === exerciseId ? "active" : ""}`}
                  onClick={() => selectExercise(ex.id)}
                  disabled={running}
                >
                  <span className="tt-task-top">
                    <span className="tt-task-icon">{ex.icon}</span>
                    <span className="tt-level">{ex.level}</span>
                  </span>
                  <span className="tt-task-name">{ex.name}</span>
                  <span className="tt-task-desc">{ex.desc}</span>
                </button>
              ))}
            </div>

            <div className="tt-controls">
              <span className="tt-label">Time limit</span>
              <div className="seg">
                {TIME_LIMITS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={limit === t.value ? "on" : ""}
                    onClick={() => setLimit(t.value)}
                    disabled={running}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="button" className="tt-btn" onClick={newText} disabled={running}>
                New text
              </button>
              <button type="button" className="tt-btn primary" onClick={newSession}>
                Restart
              </button>
            </div>
          </section>

          <section className="tt-card">
            <div className="tt-pad-head">
              <span>
                {exercise.name} · {exercise.level}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div
              ref={padRef}
              className="tt-pad"
              tabIndex={0}
              onKeyDown={handleKey}
              role="textbox"
              aria-label="Typing area"
              aria-multiline="true"
            >
              <TypingText target={text} typed={session.typed} />
            </div>
            <div className="tt-progress">
              <div style={{ width: `${progress}%` }} />
            </div>
            <p className="tt-hint">{hint}</p>
          </section>

          <section className="tt-card">
            <RGBKeyboard expected={expectedChar} active={running} />
          </section>

          {report ? (
            <ReportPanel
              r={report}
              onRetry={newSession}
              onSmart={() => selectExercise("smart")}
              onNext={() => selectExercise(report.nextId)}
            />
          ) : null}
        </div>

        <aside className="tt-side">
          <section className="tt-card">
            <h2 className="tt-card-title">Live counters</h2>
            <div className="tt-live">
              <Ring
                value={live ? live.accuracy : 0}
                text={live ? `${round(live.accuracy)}%` : "—"}
                label="Accuracy"
                color="var(--lime)"
              />
            </div>
            <div className="tt-stat-grid">
              <Tile label="Speed · net" value={live ? round(live.net) : 0} unit="WPM" tone="var(--cyan)" />
              <Tile label="Errors" value={session.errors} tone="var(--red)" />
              <Tile
                label={limit > 0 && !done ? "Time left" : "Time"}
                value={formatTime(timeShown)}
                tone="var(--amber)"
              />
              <Tile label="Keystrokes" value={session.keystrokes} tone="var(--magenta)" />
            </div>
          </section>

          <section className="tt-card">
            <h2 className="tt-card-title">Assigned task</h2>
            <div className="assign-row">
              <span>Current</span>
              <strong>{exercise.name}</strong>
            </div>
            <div className="assign-row">
              <span>Recommended next</span>
              <strong>{nextEx ? nextEx.name : "Home Row"}</strong>
            </div>
            <div className="tt-assign-actions">
              <button
                type="button"
                className="tt-btn"
                onClick={() => selectExercise(nextId)}
                disabled={running}
              >
                Assign {nextEx ? nextEx.name : "Home Row"}
              </button>
              <button
                type="button"
                className="tt-btn primary"
                onClick={() => selectExercise("smart")}
                disabled={running}
              >
                Smart Drill
              </button>
            </div>
            <p className="tt-note">
              Smart Drill builds practice text from the keys you miss most, across all your sessions.
            </p>
          </section>

          <section className="tt-card">
            <h2 className="tt-card-title">Progress</h2>
            <Sparkline
              values={history.slice(-12).map((h) => h.net)}
              id="progress-fill"
              color="#ff2bd6"
              height={110}
            />
            <div className="tt-stat-grid">
              <Tile label="Sessions" value={history.length} tone="var(--cyan)" />
              <Tile label="Best net" value={round(bestNet)} unit="WPM" tone="var(--lime)" />
              <Tile
                label="Avg accuracy"
                value={history.length ? `${round(avgAcc)}%` : "—"}
                tone="var(--amber)"
              />
              <Tile
                label="Last score"
                value={history.length ? history[history.length - 1].score : "—"}
                tone="var(--magenta)"
              />
            </div>
            {history.length > 0 ? (
              <button type="button" className="tt-link" onClick={clearHistory}>
                Clear history
              </button>
            ) : null}
          </section>
        </aside>
      </main>
    </div>
  );
}
