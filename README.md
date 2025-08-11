# 🎲 DnD Dice – Realtime (Socket.IO)

Hody kostkou pro Dungeons & Dragons sdílené v reálném čase mezi všemi hráči u stejného „stolu“ (room). Server hází kostky (crypto.randomInt), klient jen zobrazuje → férové a synchronní.

## Stack
- Node.js + Express
- Socket.IO (WebSockety)
- Jedna instance (bez Redis adapteru), ideální pro Koyeb free

---

## Lokální spuštění
```bash
npm install
npm start
# otevři http://localhost:3000
```

---

## Nasazení na Koyeb (free)
1. Na GitHubu vytvoř repo a nahraj tento projekt (branch `main`).
2. Přihlas se do Koyeb → **Create Web Service** → **GitHub** → vyber repo a branch.
3. **Builder** nech **Buildpack** (Node.js se detekuje automaticky).
4. **Run/Start command**: `npm start` (většinou se doplní samo).
5. **Exposed port**: přidej **3000** jako **HTTP** (`/`). Koyeb předá appce env `PORT`.
6. **Environment variables**: přidej `NODE_ENV=production`.
7. **Deploy**. Po chvilce dostaneš URL `https://…koyeb.app`. Otevři ve 2 oknech a zkus hodit.

> Poznámky:
> - Free plán se může po nečinnosti „uspat“ a první request ji zase probudí (počítej s pár sekundami navíc při prvním načtení).
> - Pokud bys někdy škálovala na více instancí, Socket.IO vyžaduje adapter (např. Redis). Na free jedné instanci to není potřeba.

---

## Použití
- V horní liště vyplň **Jméno** a **Stůl** (např. `stul-1`) → **Připojit**.
- Volitelně sdílej přímý odkaz s parametrem `?room=stul-1`.
- Vyber kostku (d4…d100), počet a modifikátor, klikni **Hodit!** → všichni ve stejném „stolu“ uvidí shodný výsledek.

## Bezpečnost / UX nápady (volitelné)
- Přidat „heslo stolu“ (room pass) a zvýraznění přirozené 1/20 u d20.
- Logování hodů (SQLite) – aby přežily restart.
- GM tajné hody = separátní room (např. `stul-xyz-gm`).
