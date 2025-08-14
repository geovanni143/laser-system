// frontend/src/App.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import axios from 'axios';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// -------- Util: línea legible para el historial (robusto contra NaN) --------
function evLine(p, fallbackWindowMs) {
  const t = new Date(p?.ts || Date.now());
  const hh = t.toLocaleTimeString();
  const ms = String(t.getMilliseconds()).padStart(3, '0');
  const txt = p?.type === 'hit' ? 'ACIERTA' : 'FALLO';
  const win = Number(p?.window_ms ?? fallbackWindowMs ?? 0);
  const seg = win > 0 ? (win / 1000).toFixed(1) : '—';
  return `${txt} · ventana ${seg}s · ${hh}.${ms}`;
}

/* =====================  AUDIO ENGINE  ===================== */
class Sound {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.bgInterval = null;
    this.bgGain = null;
    this.master = null;
  }
  async start() {
    if (this.started) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.started = true;
  }
  stopBg() {
    if (this.bgInterval) { clearInterval(this.bgInterval); this.bgInterval = null; }
    if (this.bgGain) { this.bgGain.gain.cancelScheduledValues(this.ctx.currentTime); this.bgGain.disconnect(); this.bgGain = null; }
  }
  // pequeño loop de fondo (arpegio suave)
  playBg() {
    if (!this.started) return;
    this.stopBg();
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.08; // muy bajito
    gain.connect(this.master);
    this.bgGain = gain;

    const base = 220; // Hz
    const notes = [0, 3, 7, 12, 7, 3]; // arpegio
    let i = 0;
    const tick = () => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const f = base * Math.pow(2, notes[i % notes.length] / 12);
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      g.gain.setValueAtTime(0.0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(g).connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
      i++;
    };
    tick();
    this.bgInterval = setInterval(tick, 420);
  }
  // beep simple (frecuencia, duración, tipo)
  beep(freq = 880, dur = 0.12, type = 'sine', vol = 0.3) {
    if (!this.started) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  }
  // “chord” corto para GO
  go() {
    if (!this.started) return;
    [523.25, 659.25, 783.99].forEach((f, k) => this.beep(f, 0.22 + k*0.02, 'sine', 0.35));
  }
  // sonidos semánticos
  click()      { this.beep(600, 0.06, 'triangle', 0.2); }
  countdown()  { this.beep(750, 0.08, 'square', 0.28); }
  success()    { this.beep(1046, 0.14, 'sine', 0.4); this.beep(1318, 0.16, 'sine', 0.3); }
  fail()       { this.beep(200, 0.16, 'sawtooth', 0.35); this.beep(150, 0.18, 'sawtooth', 0.28); }
}

export default function App() {
  /* ===================== STATE ===================== */
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [soundOn, setSoundOn] = useState(false);

  const [hits, setHits] = useState(0);
  const [miss, setMiss] = useState(0);
  const [events, setEvents] = useState([]);

  const [cfg, setCfg] = useState({
    difficulty: 'medio',
    window_ms: 3000,
    mode: 'tiro_seguro',
    switch_ms: 400,
    shrink_ms: 200,
    marathon_s: 60,
    paused: false
  });

  const roundStartRef = useRef(null);
  const [, setTick] = useState(0);
  const seen = useRef(new Set());
  const socketRef = useRef(null);
  const api = useMemo(() => axios.create({ baseURL: API }), []);
  const snd = useRef(new Sound());

  // habilitar audio en primera interacción
  const ensureAudio = async () => {
    if (!soundOn) {
      await snd.current.start();
      setSoundOn(true);
      snd.current.playBg();
    }
  };

  /* ===================== INIT + SOCKETS ===================== */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [c, s, e] = await Promise.all([
          api.get('/config').then(r => r.data),
          api.get('/score').then(r => r.data),
          api.get('/events').then(r => r.data),
        ]);
        if (!alive) return;

        setCfg(c || {});
        setHits(Number(s?.hits) || 0);
        setMiss(Number(s?.misses) || 0);

        const list = (Array.isArray(e) ? e : [])
          .slice(0, 100)
          .map(p => evLine(p, (c?.window_ms ?? 3000)));
        setEvents(list);
      } catch (err) {
        console.error(err);
      }

      socketRef.current = io(API, { transports: ['websocket'] });

      socketRef.current.on('config', c => {
        setCfg(c);
        if (c?.paused) roundStartRef.current = null;
      });

      socketRef.current.on('score', s => {
        setHits(Number(s?.hits) || 0);
        setMiss(Number(s?.misses) || 0);
      });

      socketRef.current.on('event', p => {
        const id = `${p?.type}-${p?.ts}`;
        if (seen.current.has(id)) return;
        seen.current.add(id);

        // sonidos de evento
        if (soundOn) {
          if (p?.type === 'hit') snd.current.success();
          else snd.current.fail();
        }

        if (p?.type === 'hit') setHits(h => h + 1);
        if (p?.type === 'miss') setMiss(m => m + 1);

        setEvents(prev => [evLine(p, (cfg?.window_ms ?? 3000)), ...prev].slice(0, 100));
        if (!cfg.paused) roundStartRef.current = performance.now();
      });
    })();

    const h = setInterval(() => setTick(t => t + 1), 60);
    return () => {
      alive = false;
      clearInterval(h);
      socketRef.current?.disconnect();
      snd.current.stopBg();
    };
  }, [api, soundOn]);

  /* ===================== PROGRESS BAR ===================== */
  const restantePct = (() => {
    const win = Number(cfg?.window_ms ?? 3000);
    if (cfg.paused || countdown > 0 || !roundStartRef.current || !win) return 0;
    const el = performance.now() - roundStartRef.current;
    return Math.min(100, Math.max(0, 100 * el / win));
  })();

  const restanteSeg = (() => {
    const win = Number(cfg?.window_ms ?? 3000);
    if (cfg.paused || countdown > 0 || !roundStartRef.current || !win) {
      return (win / 1000).toFixed(1);
    }
    const el = performance.now() - roundStartRef.current;
    const left = Math.max(0, win - el) / 1000;
    return left.toFixed(3);
  })();

  /* ===================== 3-2-1 FLOW (PAUSE REAL) ===================== */
  async function count3(fnAfter) {
    setBusy(true);
    try {
      await api.put('/config', { paused: true });
      await new Promise(resolve => {
        setCountdown(3);
        let n = 3;
        const t = setInterval(() => {
          if (soundOn) snd.current.countdown();
          n--; setCountdown(n);
          if (n <= 0) { clearInterval(t); setCountdown(0); resolve(); }
        }, 1000);
      });
      if (soundOn) snd.current.go();
      await fnAfter?.();
      await api.put('/config', { paused: false });
      roundStartRef.current = performance.now();
    } finally {
      setBusy(false);
    }
  }

  /* ===================== ACTIONS ===================== */
  const setDifficulty = (d) => { if (soundOn) snd.current.click(); return count3(() => api.put('/config', { difficulty: d })); };

  const changeMode = async (val) => {
    if (soundOn) snd.current.click();
    await count3(() => api.put('/config', { mode: val }));
    setCfg(c => ({ ...c, mode: val }));
  };

  const saveOptions = () => {
    if (soundOn) snd.current.click();
    return count3(() => api.put('/config', {
      mode: cfg.mode,
      switch_ms: Number(cfg.switch_ms) | 0,
      shrink_ms: Number(cfg.shrink_ms) | 0,
      marathon_s: Number(cfg.marathon_s) | 0
    }));
  };

  const resetSystem = () => {
    if (soundOn) snd.current.click();
    return count3(async () => {
      await api.post('/reset');
      await api.post('/clear-events');
      setHits(0); setMiss(0); setEvents([]);
      roundStartRef.current = null;
    });
  };

  const clearHist = () => {
    if (soundOn) snd.current.click();
    return count3(async () => {
      await api.post('/clear-events');
      setEvents([]);
    });
  };

  const togglePause = async () => {
    if (busy) return;
    if (!cfg.paused) {
      if (soundOn) snd.current.click();
      await api.put('/config', { paused: true });
      setCfg(c => ({ ...c, paused: true }));
      roundStartRef.current = null;
    } else {
      await count3(async () => {});
      setCfg(c => ({ ...c, paused: false }));
    }
  };

  // inputs controlados (edición local; se aplican con Guardar opciones)
  const change = (k) => (e) => setCfg(c => ({ ...c, [k]: e.target.value }));
  const disabled = busy || countdown > 0;

  return (
    <div className="app" onMouseDown={ensureAudio} onTouchStart={ensureAudio}>
      {countdown > 0 && (
        <div className="overlay">
          <div className="count">{countdown}</div>
        </div>
      )}

      <div className="card">
        <div className="top">
          <h1 className="title-glow">🎯 Sistema de Disparo Láser</h1>
          <div className="right-controls">
            <button
              className={`sound ${soundOn ? 'on' : 'off'}`}
              onClick={async () => {
                if (!soundOn) { await ensureAudio(); return; }
                // toggle off
                snd.current.stopBg();
                setSoundOn(false);
              }}
              title={soundOn ? 'Silenciar' : 'Activar sonido'}
            >
              {soundOn ? '🔊 Sonido ON' : '🔇 Sonido OFF'}
            </button>
            <div className="badges">
              <div className="badge ok">Aciertos: <b>{hits}</b></div>
              <div className="badge fail">Fallos: <b>{miss}</b></div>
            </div>
          </div>
        </div>

        <small className="subtitle">
          Dificultad: <b>{cfg.difficulty}</b> • LED: {(Number(cfg.window_ms) / 1000).toFixed(1)}s • Restante: {restanteSeg}s
          {cfg.paused && <span style={{ marginLeft: 8, opacity: .8 }}>• PAUSADO</span>}
        </small>
        <div className="progress"><div className="fill" style={{ width: `${restantePct}%` }} /></div>

        <div className="row">
          <button disabled={disabled} onClick={() => setDifficulty('facil')}>Fácil</button>
          <button disabled={disabled} onClick={() => setDifficulty('medio')}>Medio</button>
          <button disabled={disabled} onClick={() => setDifficulty('dificil')}>Difícil</button>
          <button disabled={busy} onClick={togglePause}>{cfg.paused ? '▶ Reanudar' : '⏸ Pausar'}</button>
        </div>

        {/* MODOS */}
        <div className="modes">
          <div className="mode">
            <h3>🟦 Tiro Seguro</h3>
            <p>Se enciende un foco azul. Tienes unos segundos para darle. Si aciertas: <b>+1 punto</b>.</p>
          </div>
          <div className="mode">
            <h3>⚡ Rayo Loco</h3>
            <p>Durante la misma ventana el foco <b>va saltando</b> entre posiciones. Cada acierto: <b>+2 puntos</b>.</p>
          </div>
          <div className="mode">
            <h3>🔢 Secuencia</h3>
            <p>Los focos van <b>1 → 2 → 3</b>. Sigue el orden para hacer racha.</p>
          </div>
          <div className="mode">
            <h3>🎯 Caza</h3>
            <p>Cada acierto recorta un poco la próxima ventana. Empieza fácil y se pone retador.</p>
          </div>
          <div className="mode">
            <h3>⏱️ Maratón</h3>
            <p>Juegas por tiempo. Al final, gana quien tenga <b>más puntos</b>.</p>
          </div>
        </div>

        {/* OPCIONES */}
        <div className="kv">
          <label>Modo</label>
          <select value={cfg.mode} onChange={(e) => changeMode(e.target.value)} disabled={disabled}>
            <option value="tiro_seguro">Tiro Seguro</option>
            <option value="rayo_loco">Rayo Loco</option>
            <option value="secuencia">Secuencia</option>
            <option value="caza">Caza</option>
            <option value="maraton">Maratón</option>
          </select>

          <label>Switch (ms) — Rayo Loco</label>
          <input type="number" value={cfg.switch_ms} onChange={change('switch_ms')} min="100" max="1000" disabled={disabled} />

          <label>Recorte por acierto (ms) — Caza</label>
          <input type="number" value={cfg.shrink_ms} onChange={change('shrink_ms')} min="10" max="1000" disabled={disabled} />

          <label>Duración total (s) — Maratón</label>
          <input type="number" value={cfg.marathon_s} onChange={change('marathon_s')} min="10" max="600" disabled={disabled} />
        </div>

        <div className="footer">
          <button className="primary" disabled={disabled} onClick={saveOptions}>Guardar opciones</button>
          <button className="green"   disabled={disabled} onClick={resetSystem}>🔄 Reiniciar sistema</button>
          <div style={{ flex: 1 }} />
          <button className="red" disabled={disabled} onClick={clearHist}>🗑 Borrar historial</button>
        </div>

        <div className="hist">
          <h3>📜 Historial</h3>
          <ul>{events.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}
