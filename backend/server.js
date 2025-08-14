// backend/server.js  (CommonJS)
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

app.use(cors());
app.use(express.json());

// ====== Estado del sistema ======
const diffMs = { facil: 5000, medio: 3000, dificil: 2000 };

let state = {
  paused: true,                 // comienza pausado
  difficulty: 'medio',
  window_ms: diffMs['medio'],
  mode: 'tiro',                 // 'tiro' | 'rayo' | 'secuencia' | 'caza' | 'maraton'
  switch_ms: 400,               // para Rayo loco
  shrink_ms: 200,               // para Caza (el ESP puede ignorarlo si no lo usa)
  marathon_s: 60                // para Maratón (la app lo cronometra)
};

let score = { hits: 0, misses: 0 };
let currentCountdown = null;    // timeout del servidor

// ====== helpers ======
function broadcastConfig() { io.emit('config', state); }
function broadcastScore()  { io.emit('score', score); }

function beginCountdown(sec = 3) {
  // Cancela countdowns previos
  if (currentCountdown) { clearTimeout(currentCountdown); currentCountdown = null; }

  // Pone pausa, avisa a la UI y reanuda tras sec
  state.paused = true;
  broadcastConfig();
  io.emit('countdown', { sec });

  currentCountdown = setTimeout(() => {
    state.paused = false;
    broadcastConfig();
    currentCountdown = null;
  }, sec * 1000);
}

function setDifficulty(d) {
  if (!diffMs[d]) return;
  state.difficulty = d;
  state.window_ms = diffMs[d];
}

// ====== Rutas HTTP ======
app.get('/config', (req, res) => res.json(state));

app.put('/config', (req, res) => {
  const { difficulty, window_ms, mode, switch_ms, shrink_ms, marathon_s } = req.body || {};

  if (difficulty) setDifficulty(String(difficulty));
  if (typeof window_ms === 'number') state.window_ms = Math.max(200, window_ms);

  if (mode) state.mode = String(mode);
  if (typeof switch_ms === 'number')   state.switch_ms   = Math.max(100, switch_ms|0);
  if (typeof shrink_ms === 'number')   state.shrink_ms   = Math.max(10,  shrink_ms|0);
  if (typeof marathon_s === 'number')  state.marathon_s  = Math.max(5,   marathon_s|0);

  beginCountdown(3); // cada cambio aplica con 3-2-1
  res.json(state);
});

app.post('/pause', (req, res) => {
  const { paused, countdown, sec } = req.body || {};
  if (typeof paused === 'boolean') {
    if (!paused && countdown) {
      beginCountdown(Number(sec) || 3);
    } else {
      // pausa o reanuda inmediato
      if (currentCountdown) { clearTimeout(currentCountdown); currentCountdown = null; }
      state.paused = paused;
      broadcastConfig();
    }
  }
  res.json({ paused: state.paused });
});

app.post('/reset', (req, res) => {
  score = { hits: 0, misses: 0 };
  broadcastScore();
  beginCountdown(3);
  res.json({ ok: true });
});

app.get('/score', (req, res) => res.json(score));

app.post('/event', (req, res) => {
  // Llamado por el ESP.
  const { type, ts, window_ms, targetId } = req.body || {};
  // Si está pausado, ignoramos eventos del ESP
  if (state.paused) return res.json({ ignored: true });

  if (type === 'hit') score.hits++;
  else if (type === 'miss') score.misses++;

  broadcastScore();

  // Reenvía a la UI con los datos que interesan
  io.emit('event', {
    type,
    ts: ts || Date.now(),
    window_ms: window_ms || state.window_ms,
    targetId: typeof targetId === 'number' ? targetId : null,
    score
  });

  res.json({ ok: true });
});

app.get('/state', (req, res) => {
  res.json({ state, score });
});

// ====== Socket.IO ======
io.on('connection', (socket) => {
  // Al conectar, enviamos estado/score
  socket.emit('config', state);
  socket.emit('score', score);
});

// ====== Lanzar ======
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listo en http://0.0.0.0:${PORT}`);
});
