const express = require('express');
const http = require('http');
const path = require('path');
const { randomInt } = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const ALLOWED_SIDES = [4, 6, 8, 10, 12, 20, 100];

function sanitizeName(s) {
  return String(s || '')
    .trim()
    .slice(0, 32)
    .replace(/[^\p{L}\p{N}\s_.\-]/gu, '');
}
function sanitizeRoom(s) {
  return String(s || 'stul-1')
    .trim()
    .slice(0, 32)
    .replace(/[^\w\-]/g, '');
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let playerName = 'Hráč';

  socket.on('join-room', ({ room, player }) => {
    currentRoom = sanitizeRoom(room);
    playerName = sanitizeName(player) || 'Hráč';
    socket.join(currentRoom);
    socket.emit('joined', { room: currentRoom, player: playerName });
    socket.to(currentRoom).emit('system', {
      text: `${playerName} se připojil(a).`,
      ts: Date.now()
    });
  });

socket.on('roll-dice', (payload) => {
  if (!currentRoom) return;
  let { sides, count, modifier, mode } = payload || {};
  sides = Number(sides);
  count = Number(count);
  modifier = Number(modifier) || 0;
  mode = (mode === 'adv' || mode === 'dis') ? mode : undefined;

  if (!ALLOWED_SIDES.includes(sides)) return;
  if (!(count >= 1 && count <= 10)) return;
  if (!(modifier >= -99 && modifier <= 99)) modifier = 0;

  const rolls = [];
  // advantage / disadvantage (d20 only)
  if (mode && sides === 20) {
    for (let i = 0; i < count; i++) {
      const a = randomInt(1, 21);
      const b = randomInt(1, 21);
      rolls.push(mode === 'adv' ? Math.max(a, b) : Math.min(a, b));
    }
  } else {
    for (let i = 0; i < count; i++) rolls.push(randomInt(1, sides + 1));
  }

  const subtotal = rolls.reduce((a, b) => a + b, 0);
  const total = subtotal + modifier;

  const result = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    player: playerName,
    room: currentRoom,
    sides, count, modifier, mode: mode || 'normal',
    rolls, subtotal, total,
    ts: Date.now()
  };

  io.to(currentRoom).emit('dice-result', result);
});

  socket.on('disconnect', () => {
    if (currentRoom && playerName) {
      socket.to(currentRoom).emit('system', {
        text: `${playerName} se odpojil(a).`,
        ts: Date.now()
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server běží na portu ${PORT}`));
