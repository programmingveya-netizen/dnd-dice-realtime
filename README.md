# DnD Dice — Realtime Roller (3D + Rooms)

A lightweight, realtime dice roller for tabletop sessions. Join the same **room** with your friends and share identical results. Includes a clean UI, a sidebar feed (newest on top), optional sound, on-canvas **3D dice** (Three.js), and a simple player **Scoreboard** (last roll + average).

## Features
- Realtime rooms (shared rolls per table)
- Dice presets: d4, d6, d8, d10, d12, d20, d100 (+ modifier, count)
- Advantage / Disadvantage quick actions (d20)
- 3D dice animation (performance-friendly, no physics)
- Optional synthesized sound (no audio files)
- Results feed (newest first), CSV export, clear results
- Player scoreboard (last roll & average)
- (Optional, planned) GM controls: lock table, clear for everyone, transfer GM

## Tech
- **Server:** Node.js, Express, Socket.IO
- **Client:** Vanilla JS, Three.js, Tween.js
- **Hosting:** works fine on free tiers (e.g. Render)

## Quick Start (Local)
```bash
npm i
npm start
# open http://localhost:3000

#How it Works
The server rolls the dice (crypto-secure RNG) and broadcasts the same result to everyone in the room.

The client animates 3D dice, plays an optional sound, and updates the feed + scoreboard.

