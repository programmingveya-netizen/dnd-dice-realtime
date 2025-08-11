(() => {
  const socket = io();
  const playerInput = document.getElementById('playerInput');
  const roomInput = document.getElementById('roomInput');
  const joinBtn = document.getElementById('joinBtn');
  const shareBtn = document.getElementById('shareBtn');

  const sidesSelect = document.getElementById('sidesSelect');
  const countInput = document.getElementById('countInput');
  const modInput = document.getElementById('modInput');
  const rollBtn = document.getElementById('rollBtn');
  const feed = document.getElementById('feed');

  // Načti výchozí hodnoty
  playerInput.value = localStorage.getItem('playerName') || '';
  const params = new URLSearchParams(location.search);
  roomInput.value = params.get('room') || 'stul-1';

  function joinRoom() {
    const player = (playerInput.value || '').trim() || 'Hráč';
    const room = (roomInput.value || '').trim() || 'stul-1';
    localStorage.setItem('playerName', player);
    socket.emit('join-room', { room, player });
    // Uprav URL (bez reloadu), ať se dá snadno sdílet
    const url = new URL(location.href);
    url.searchParams.set('room', room);
    history.replaceState(null, '', url.toString());
  }

  function formatNotation(count, sides, mod) {
    const base = `${count}d${sides}`;
    if (!mod || mod === 0) return base;
    const sign = mod > 0 ? '+' : '';
    return `${base} ${sign}${mod}`;
  }

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
    for (const r of res.rolls) {
      const d = document.createElement('span');
      d.className = 'die';
      d.textContent = r;
      rollsWrap.appendChild(d);
    }

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

  // Socket události
  socket.on('joined', ({ room, player }) => {
    addSystemMessage(`Připojeno ke stolu „${room}“ jako ${player}.`, Date.now());
  });

  socket.on('system', (msg) => {
    addSystemMessage(msg.text, msg.ts || Date.now());
  });

  socket.on('dice-result', (res) => {
    addResultItem(res);
  });

  // Ovládání UI
  joinBtn.addEventListener('click', joinRoom);
  playerInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  roomInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });

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

  // Auto-join po načtení
  joinRoom();
})();
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
  notation.textContent = `${res.count}d${res.sides}` + (res.modifier ? (res.modifier > 0 ? ` +${res.modifier}` : ` ${res.modifier}`) : '');

  const rollsWrap = document.createElement('span');

  // vytvoř "rolling" elementy a animuj čísla chvilku před zobrazením výsledku
  const ANIM_TICKS = 12;   // kolikrát náhodně přebliknout
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

