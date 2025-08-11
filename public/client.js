document.addEventListener('DOMContentLoaded', () => {
  // 1) Kontrola Socket.IO
  if (!window.io) {
    alert('Realtime knihovna (Socket.IO) se nenačetla. Nasazuj jako Web Service, ne Static Site.');
    return;
  }

  // 3D scéna (pokud existuje dice3d.js a #dice3d)
  if (window.Dice3D) {
    try { Dice3D.init('dice3d'); } catch (e) { console.warn('Dice3D init error:', e); }
  }

  // 2) Najdi prvky v DOM
  const $ = (id) => document.getElementById(id);
  const playerInput = $('playerInput');
  const roomInput   = $('roomInput');
  const joinBtn     = $('joinBtn');
  const shareBtn    = $('shareBtn');
  const sidesSelect = $('sidesSelect');
  const countInput  = $('countInput');
  const modInput    = $('modInput');
  const rollBtn     = $('rollBtn');
  const feed        = $('feed');

  const missing = [playerInput, roomInput, joinBtn, shareBtn, sidesSelect, countInput, modInput, rollBtn, feed]
    .some(x => !x);
  if (missing) {
    alert('Chybí některé elementy podle ID. Zkontroluj prosím index.html (ID musí sedět).');
    return;
  }

  // 3) Připojení k Socket.IO
  const socket = io();

  // 4) Helpery
  playerInput.value = localStorage.getItem('playerName') || '';
  const params = new URLSearchParams(location.search);
  roomInput.value = params.get('room') || 'stul-1';

  function addSystemMessage(text, ts) {
    const div = document.createElement('div');
    div.className = 'item';
    const meta = document.createElement('div');
    meta.className = 'meta sys';
    meta.textContent = `${new Date(ts).toLocaleTimeString()} · ${text}`;
    div.appendChild(meta);
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  function formatNotation(count, sides, mod) {
    const base = `${count}d${sides}`;
    if (!mod || mod === 0) return base;
    const sign = mod > 0 ? '+' : '';
    return `${base} ${sign}${mod}`;
  }

  // 5) Výpis výsledků + lehká 2D animace
  function addResultItem(res) {
    const div = document.createElement('div');
    div.className = 'item';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const who = document.createElement('div'); who.textContent = res.player;
    const when = document.createElement('div'); when.textContent = new Date(res.ts).toLocaleTimeString();
    meta.appendChild(who); meta.appendChild(when);

    const resLine = document.createElement('div');
    resLine.className = 'res';

    const notation = document.createElement('span');
    notation.className = 'badge';
    notation.textContent = formatNotation(res.count, res.sides, res.modifier);

    const rollsWrap = document.createElement('span');

    const ANIM_TICKS = 12;
    const TICK_MS = 50;

    res.rolls.forEach((finalVal) => {
      const d = document.createElement('span');
      d.className = 'die rolling';
      let t = 0;
      const flicker = setInterval(() => {
        d.textContent = 1 + Math.floor(Math.random() * res.sides);
        if (++t >= ANIM_TICKS) {
          clearInterval(flicker);
          d.classList.remove('rolling');
          d.textContent = finalVal;
          if (res.sides === 20) {
            if (finalVal === 20) d.classList.add('nat20');
            if (finalVal === 1)  d.classList.add('nat1');
          }
        }
      }, TICK_MS);
      rollsWrap.appendChild(d);
    });

    const total = document.createElement('span');
    total.className = 'total';
    total.textContent = `Celkem: ${res.total}`;

    resLine.appendChild(notation);
    resLine.appendChild(rollsWrap);
    resLine.appendChild(total);

    div.appendChild(meta);
    div.appendChild(resLine);
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }

  function joinRoom() {
    const player = (playerInput.value || '').trim() || 'Hráč';
    const room = (roomInput.value || '').trim() || 'stul-1';
    localStorage.setItem('playerName', player);
    socket.emit('join-room', { room, player });
    const url = new URL(location.href);
    url.searchParams.set('room', room);
    history.replaceState(null, '', url.toString());
  }

  // 6
