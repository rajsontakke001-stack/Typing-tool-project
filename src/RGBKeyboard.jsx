import { useState, useEffect, useRef } from "react";

/* ================================ LAYOUT ================================ */

// A key is { id, label, w }, where w is its width in key units (a standard key is 1).
const u = (id, label, w = 1) => ({ id, label, w });
const chars = (s) => s.split("").map((c) => u(c, c.toUpperCase(), 1));

const ROWS = [
  [...chars("`1234567890-="), u("backspace", "⌫", 2)],
  [u("tab", "Tab", 1.5), ...chars("qwertyuiop"), ...chars("[]"), u("\\", "\\", 1.5)],
  [u("caps", "Caps", 1.75), ...chars("asdfghjkl"), ...chars(";'"), u("enter", "Enter", 2.25)],
  [u("shiftL", "Shift", 2.25), ...chars("zxcvbnm"), ...chars(",./"), u("shiftR", "Shift", 2.75)],
  [
    u("ctrlL", "Ctrl", 1.25),
    u("metaL", "Win", 1.25),
    u("altL", "Alt", 1.25),
    u("space", "", 7.5),
    u("altR", "Alt", 1.25),
    u("metaR", "Win", 1.25),
    u("ctrlR", "Ctrl", 1.25),
  ],
];
const ALL_KEYS = ROWS.flat();

// Centre of every key, in key units. Used by the ripple effect.
const KEY_POS = {};
ROWS.forEach((row, r) => {
  let x = 0;
  row.forEach((k) => {
    KEY_POS[k.id] = { x: x + k.w / 2, y: r + 0.5 };
    x += k.w;
  });
});
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

// Shifted symbols light the physical key they sit on.
const SHIFTED = {
  "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", "\"": "'", "<": ",", ">": ".", "?": "/", "~": "`",
};
const NAMED = { " ": "space", Backspace: "backspace", Tab: "tab", CapsLock: "caps", Enter: "enter" };
const MODIFIER = { Shift: "shift", Control: "ctrl", Alt: "alt", AltGraph: "alt", Meta: "meta" };

// Which physical key a keyboard event belongs to. Left and right modifiers are told apart by e.location.
function keyIdOf(e) {
  if (MODIFIER[e.key]) return MODIFIER[e.key] + (e.location === 2 ? "R" : "L");
  if (NAMED[e.key]) return NAMED[e.key];
  if (e.key.length === 1) return SHIFTED[e.key] || e.key.toLowerCase();
  return null;
}

// Which physical key a character sits on, and whether Shift is needed to type it.
const charToKeyId = (c) => (c === " " ? "space" : SHIFTED[c] || c.toLowerCase());
const needsShift = (c) => /[A-Z]/.test(c) || !!SHIFTED[c];

/* ================================ COLOUR ================================ */

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// h, s, v are all 0..1
function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

const GREEN = [0.18, 0.76, 0.49];
const RED = [1, 0.3, 0.43];
const AMBER = [1, 0.82, 0.24];

/* ============================ MODES & SETTINGS ============================ */

const MODES = [
  { id: "static", name: "Static", hint: "One steady colour across the whole keyboard." },
  { id: "breathing", name: "Breathing", hint: "The colour fades in and out slowly." },
  { id: "rainbow", name: "Rainbow", hint: "Colours roll smoothly from left to right." },
  { id: "reactive", name: "Reactive", hint: "Each key lights up when you press it, then fades." },
  { id: "ripple", name: "Ripple", hint: "Every press sends a ring of light across the board." },
  { id: "accuracy", name: "Accuracy", hint: "Green for a correct key, red for a mistake." },
];

const PALETTE = ["#00f0ff", "#ff2bd6", "#b6ff3b", "#ffd23f", "#ff4d6d", "#7b2cff", "#ffffff", "#ff7a00"];

const DEFAULTS = { on: true, mode: "reactive", color: "#00f0ff", brightness: 80, speed: 5, guide: true };
const LIGHT_KEY = "typing-tool-lights";

function loadLights() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LIGHT_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveLights(c) {
  try {
    localStorage.setItem(LIGHT_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

/* ============================ LIGHT ENGINE ============================ */

// 1 right after a key was pressed, fading to 0 over `life` seconds.
function flashAt(f, now, life) {
  if (!f) return 0;
  const age = now - f.t;
  return age >= 0 && age < life ? 1 - age / life : 0;
}

// Colour (r, g, b in 0..1) and strength (0..1) of one key at time `now` in seconds.
function keyLight(id, now, cfg, st) {
  if (!cfg.on) return [0, 0, 0, 0];

  const held = st.held.has(id);
  const f = st.flash[id];
  let rgb = cfg.rgb;
  let a = 0;

  switch (cfg.mode) {
    case "static":
      a = held ? 1 : 0.6;
      break;

    case "breathing": {
      const pulse = 0.5 + 0.5 * Math.sin(now * cfg.sp * 2.4);
      a = held ? 1 : 0.12 + 0.88 * pulse;
      break;
    }

    case "rainbow": {
      const hue = ((KEY_POS[id].x / 16 - now * cfg.sp * 0.15) % 1 + 1) % 1;
      rgb = hsvToRgb(hue, 1, 1);
      a = held ? 1 : 0.75;
      break;
    }

    case "reactive":
      a = held ? 1 : 0.1 + 0.9 * flashAt(f, now, 0.9);
      break;

    case "ripple": {
      let best = 0;
      st.ripples.forEach((rp) => {
        const age = now - rp.t;
        const radius = age * cfg.sp * 4;
        const band = Math.exp(-((dist(KEY_POS[id], KEY_POS[rp.id]) - radius) ** 2) / 0.8);
        best = Math.max(best, band * Math.max(0, 1 - age / 2.6));
      });
      a = held ? 1 : 0.08 + 0.92 * best;
      break;
    }

    case "accuracy": {
      const fi = flashAt(f, now, 0.6);
      if (f && fi > 0 && f.kind !== "neutral") rgb = f.kind === "ok" ? GREEN : RED;
      a = held ? 0.8 : 0.1 + 0.9 * fi;
      break;
    }

    default:
      a = 0;
  }

  // next-key guide: the key you should press next pulses amber
  if (cfg.guide && cfg.guideSet.has(id)) {
    rgb = AMBER;
    a = Math.max(a, 0.5 + 0.5 * Math.sin(now * 7));
  }

  return [rgb[0], rgb[1], rgb[2], Math.min(1, a * cfg.brightness)];
}

/* ================================ COMPONENT ================================ */

export default function RGBKeyboard({ expected = null, active = false }) {
  const [cfg, setCfg] = useState(loadLights);
  const [lastKey, setLastKey] = useState("");

  // Live state for the animation loop. Kept out of React state so 60 frames a second stay cheap.
  const stRef = useRef({ held: new Set(), flash: {}, ripples: [] });
  const elsRef = useRef({});
  const activeRef = useRef(active);
  const expectedRef = useRef(expected);

  const guideSet = new Set();
  if (expected) {
    guideSet.add(charToKeyId(expected));
    if (needsShift(expected)) {
      guideSet.add("shiftL");
      guideSet.add("shiftR");
    }
  }

  const cfgRef = useRef(null);
  cfgRef.current = {
    on: cfg.on,
    mode: cfg.mode,
    rgb: hexToRgb(cfg.color),
    sp: cfg.speed / 5,
    brightness: cfg.brightness / 100,
    guide: cfg.guide,
    guideSet,
  };
  activeRef.current = active;
  expectedRef.current = expected;

  useEffect(() => {
    saveLights(cfg);
  }, [cfg]);

  // Listen in the capture phase, so the lights see each key before the typing pad handles it.
  useEffect(() => {
    const st = stRef.current;

    const onDown = (e) => {
      const id = keyIdOf(e);
      if (!id) return;
      st.held.add(id);
      if (e.repeat) return;

      const now = performance.now() / 1000;
      let kind = "neutral";
      if (activeRef.current && e.key.length === 1) {
        kind = e.key === expectedRef.current ? "ok" : "bad";
      }
      st.flash[id] = { t: now, kind };

      if (KEY_POS[id]) {
        st.ripples.push({ id, t: now });
        if (st.ripples.length > 12) st.ripples.shift();
      }
      setLastKey(e.key === " " ? "Space" : e.key);
    };

    const onUp = (e) => {
      const id = keyIdOf(e);
      if (id) st.held.delete(id);
    };

    const onBlur = () => st.held.clear();

    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Animation loop: writes each key's colour straight to the DOM.
  useEffect(() => {
    const st = stRef.current;
    let raf = 0;

    const frame = (ts) => {
      const now = ts / 1000;
      const c = cfgRef.current;
      st.ripples = st.ripples.filter((r) => now - r.t < 3);

      for (const k of ALL_KEYS) {
        const el = elsRef.current[k.id];
        if (!el) continue;
        const [r, g, b, a] = keyLight(k.id, now, c, st);
        el.style.setProperty(
          "--lc",
          `${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}`
        );
        el.style.setProperty("--la", a.toFixed(3));
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const update = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const modeInfo = MODES.find((m) => m.id === cfg.mode) || MODES[0];

  return (
    <div className="kbx">
      <div className="kbx-top">
        <div className="kbx-readout">
          <span className="kbx-chip">
            Next<b>{expected == null ? "—" : expected === " " ? "Space" : expected}</b>
          </span>
          <span className="kbx-chip">
            Last<b>{lastKey || "—"}</b>
          </span>
        </div>
        <span className={`kbx-led ${cfg.on ? "on" : ""}`} title={cfg.on ? "Lights on" : "Lights off"} />
      </div>

      <div className="kb-board" role="img" aria-label="Keyboard">
        {ROWS.map((row, r) => (
          <div className="kb-row" key={r}>
            {row.map((k) => (
              <div
                key={k.id}
                ref={(el) => {
                  if (el) elsRef.current[k.id] = el;
                }}
                className={`kb-key ${k.id === "space" ? "space" : ""}`}
                style={{ flex: `${k.w} 1 0` }}
              >
                {k.label}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="lt">
        <div className="lt-row">
          <span className="lt-label">Lights</span>
          <button
            type="button"
            className={`lt-switch ${cfg.on ? "on" : ""}`}
            onClick={() => update({ on: !cfg.on })}
            aria-pressed={cfg.on}
            aria-label="Keyboard lights on or off"
          >
            <span className="lt-knob" />
          </button>
          <span className="lt-state">{cfg.on ? "ON" : "OFF"}</span>
        </div>

        <div className="lt-modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`lt-mode ${cfg.mode === m.id ? "on" : ""}`}
              onClick={() => update({ mode: m.id })}
            >
              {m.name}
            </button>
          ))}
        </div>
        <p className="lt-hint">{modeInfo.hint}</p>

        <div className="lt-row">
          <span className="lt-label">Colour</span>
          <div className="lt-swatches">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`lt-swatch ${cfg.color === c ? "on" : ""}`}
                style={{ background: c }}
                onClick={() => update({ color: c })}
                aria-label={`Colour ${c}`}
              />
            ))}
            <label className="lt-custom" title="Pick any colour">
              <input type="color" value={cfg.color} onChange={(e) => update({ color: e.target.value })} />
            </label>
          </div>
        </div>

        <label className="lt-slider">
          <span>Brightness</span>
          <input
            type="range"
            min="0"
            max="100"
            value={cfg.brightness}
            onChange={(e) => update({ brightness: Number(e.target.value) })}
          />
          <b>{cfg.brightness}%</b>
        </label>

        <label className="lt-slider">
          <span>Speed</span>
          <input
            type="range"
            min="1"
            max="10"
            value={cfg.speed}
            onChange={(e) => update({ speed: Number(e.target.value) })}
          />
          <b>{cfg.speed}</b>
        </label>

        <div className="lt-row">
          <label className="lt-check">
            <input type="checkbox" checked={cfg.guide} onChange={(e) => update({ guide: e.target.checked })} />
            Show the next key
          </label>
          <button type="button" className="lt-reset" onClick={() => update({ ...DEFAULTS })}>
            Reset lights
          </button>
        </div>
      </div>
    </div>
  );
}
