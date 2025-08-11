document.addEventListener('DOMContentLoaded', () => {
  // --- Pomocné: loguj do feedu; když chybí #feed, pišeme do body ---
  let feed = document.getElementById('feed');
  function logToFeed(text) {
    const row = document.createElement('div');
    row.className = 'item';
    const meta = document.createElement('div');
    meta.className = 'meta sys';
    meta.textContent = new Date().toLocaleTimeString() + ' · ' + text;
    row.appendChild(meta);
    (feed || document.body).appendChild(row);  // fallback do body
    try { (feed || document.body).scrollTop = (feed || document.body).scrollHeight; } catch {}
  }

  window.addEventListener('error', (e) => logToFeed('Chyba: ' + (e.message || e)));

  logToFeed('📦 client.js start');

  // --- 3D init (bezpečné; když Three.js chybí, jen se to přeskočí) ---
  if (window.Dice3D) {
    try { Dice3D.init('dice3d'); logToFeed('🧊 3D inicializováno'); } 
    catch (e) { logToFeed('3D chyba: ' + e.message); }
  } else {
    logToFeed('3D modul (dice3d.js) není k dispozici – nevadí');
  }

  // --- Najdi prvky v DOM ---
  const $ = (id) => document.getElementById(id);
  const playerInput = $('playerInput');
  const roomInput   = $('roomInput');
  const joinBtn     = $('joinBtn');
  const shareBtn    = $('shareBtn');
  const sidesSelect = $('sidesSelect');
  const countInput  = $('countInput');
  const modInput    = $('modInput');
  const rollBtn     = $('rollBtn');

  const missing = [playerInput, roomInput, joinBtn, shareBtn, sidesSelect, countInput, modInput, rollBtn, feed]
    .filter(x => !x).length;
  if (missing) {
    logToFeed('❌ Chybí ' + missing + ' prvků v HTML (zkontroluj ID v index.html).');
    return;
  }
  logToFeed('✅ DOM prvky OK');

  // --- Připojení k Socket.IO (NEZASTAVUJEME se ani když chybí io) ---
  if (!window.io) {
    logToFeed('❌ window.io chybí – soubor /socket.io/socket.io.js se nenačetl');
  }
  const socket = window.io ? io() : null;

  // --- Helpery ---
  playerInput.value = localStorage.getItem('playerName') || '';
  const params = new URLSearchParams(location.search);
  roomInput.value = params.get('room') || 'stul-1';

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
    notation.textContent = `${res.count}d${res.sides}${res.modifier ? (res.modifier>0? ' +' : ' ') + res.modifier : ''}`;

    const rollsWrap = document.createElement('span');
    const ANIM_TICKS = 12, TICK_MS = 50;
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
    if (socket) {
      socket.emit('join-room', { room, player });
      logToFeed('📡 Poslán join-room: ' + room + ' (' + player + ')');
    } else {
      logToFeed('❌ Nelze poslat join-room – socket není k dispozici');
    }
    const url = new URL(location.href);
    url.searchParams.set('room', room);
    history.replaceState(null, '', url.toString());
  }

  // --- Socket události (pokud socket existuje) ---
  if (socket) {
    socket.on('connect', () => logToFeed('✅ Připojeno k serveru (' + socket.id + ')'));
    socket.on('connect_error', (err) => logToFeed('⚠️ connect_error: ' + (err && err.message)));
    socket.on('joined', ({ room, player }) => logToFeed(`✅ Připojeno ke stolu „${room}“ jako ${player}.`));
    socket.on('system', (msg) => logToFeed((msg && msg.text) || 'system'));
    socket.on('dice-result', (res) => {
      addResultItem(res);
      if (window.Dice3D) {
        try { Dice3D.roll(res.sides, res.rolls); } catch (e) { logToFeed('3D roll chyba: ' + e.message); }
      }
    });
  }

  // --- Ovládání UI ---
  joinBtn.addEventListener('click', joinRoom);
  playerInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
  roomInput.addEventListener('keydown',  e => { if (e.key === 'Enter') joinRoom(); });

  shareBtn.addEventListener('click', async () => {
    const url = new URL(location.href);
    url.searchParams.set('room', (roomInput.value || 'stul-1').trim());
    try { await navigator.clipboard.writeText(url.toString()); logToFeed('🔗 Odkaz zkopírován'); }
    catch { logToFeed('⚠️ Nepodařilo se zkopírovat odkaz'); }
  });

  rollBtn.addEventListener('click', () => {
    if (!socket) { logToFeed('❌ Nelze hodit – socket neexistuje'); return; }
    const sides = parseInt(sidesSelect.value, 10);
    const count = Math.min(10, Math.max(1, parseInt(countInput.value || '1', 10)));
    const modifier = Math.min(99, Math.max(-99, parseInt(modInput.value || '0', 10)));
    socket.emit('roll-dice', { sides, count, modifier });
    logToFeed(`🎯 roll-dice odeslán (${count}d${sides}${modifier? (modifier>0?'+':'')+modifier : ''})`);
  });

  // --- Auto-join po načtení ---
  joinRoom();
  logToFeed('▶️ joinRoom() spuštěn (auto)');
});
