document.addEventListener('DOMContentLoaded', () => {
  // 1) Kontrola Socket.IO
  if (!window.io) {
    alert('Realtime knihovna (Socket.IO) se nenačetla. Nasazuj jako Web Service, ne Static Site.');
    return;
  }

  // 2) Najdi prvky v DOM (když chybí ID, zobrazíme chybovou hlášku – nic se nezablokuje)
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
  const socket = io(); // stejné origin, funguje i na Renderu

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

  // 5) Animované zobrazení výsledků (shake → finální čísla, + highlight nat1/nat20)
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

    const ANIM_TICKS = 12; // kolikrát „přebliknout“
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

  // 6) Socket události
  socket.on('connect', () => addSystemMessage('✅ Připojeno k serveru.', Date.now()));
  socket.on('connect_error', (err) => addSystemMessage('⚠️ Problém s připojením: ' + err.message, Date.now()));
  socket.on('joined', ({ room, player }) => addSystemMessage(`Připojeno ke stolu „${room}“ jako ${player}.`, Date.now()));
  socket.on('system', (msg) => addSystemMessage(msg.text, msg.ts || Date.now()));
  socket.on('dice-result', (res) => addResultItem(res));

  // 7) Ovládání UI
  joinBtn.addEventListener('click', joinRoom);
  playerInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  roomInput.addEventListener('keydown',  e => { if (e.key === 'Enter') joinRoom(); });

  shareBtn.addEventListener('click', async () => {
    const url = new URL(location.href);
    url.searchParams.set('room', (roomInput.value || 'stul-1').trim());
    try {
      await navigator.clipboard.writeText(url.toString());
      addSystemMessage('Odkaz na stůl zkopírován do schránky.', Date.now());
    } catch {
      addSystemMessage('Nepodařilo se zkopírovat odkaz.', Date.now());
    }
  });

  rollBtn.addEventListener('click', () => {
    const sides = parseInt(sidesSelect.value, 10);
    const count = Math.min(10, Math.max(1, parseInt(countInput.value || '1', 10)));
    const modifier = Math.min(99, Math.max(-99, parseInt(modInput.value || '0', 10)));
    socket.emit('roll-dice', { sides, count, modifier });
  });

  // 8) Auto-join po načtení
  joinRoom();
});
