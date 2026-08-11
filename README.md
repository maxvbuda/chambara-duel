# Chambara Duel

A browser-based, physics-driven 3D weapon duel inspired by *1-2-Switch*'s **Chambara** minigame — swing your weapon like a Joy-Con, knock your rival off the floating platform, first to score wins.

Rendered in full 3D with [Three.js](https://threejs.org/) (WebGL) — real-time shadows, ACES tone mapping, bloom post-processing, a dynamic tracking camera, and particle effects — loaded straight from a CDN via an import map, so it's still a static site: no build step, no npm install. Open `index.html` or serve the folder statically and play.

▶️ **[Play it live](https://maxvbuda.github.io/chambara-duel/)**

## How it works

There's no "attack" button. Your weapon is spring-mounted to your hand and always chases wherever you're aiming — move the mouse (or a stick) in an arc and the weapon swings with real angular velocity, now fully in 3D. Swing fast enough and it becomes a live hit, complete with a glowing motion trail, a spark burst, and camera shake; the faster the swing, the harder the knockback. It's the same physical, motion-control feel as the original Joy-Con game, translated to mouse/keyboard/gamepad.

The arena is a fully 3D floating stage — circle your rival instead of just strafing left and right. A Smash-style camera dynamically zooms and reframes based on how far apart the two duelists are. Get knocked off the platform and your opponent scores a point. First to the target score (3/5/7, selectable in the menu) wins the match.

## Controls

**Player 1**
- `↑` `↓` `←` `→` — move (full 3D — strafe and step in/out)
- `Space` — jump
- Mouse — aim & swing your weapon
- `Shift` — brace (block, cancels most knockback)

**Player 2** *(or CPU in 1P mode)*
- `↑` `↓` `←` `→` — move (full 3D) — note: same keys as Player 1, so 2P Local Duel currently has a control conflict
- Right `Shift` — jump
- `I` / `J` / `K` / `L` — aim & swing your weapon
- `Ctrl` — brace (block)

**Gamepad** (either slot, auto-detected): left stick to move, right stick to aim/swing, `A` to jump, either shoulder button to brace.

Press `Esc` any time during a match to return to the menu.

## Modes

- **1P vs CPU** — duel a simple reactive AI that closes distance, winds up, and occasionally braces your swings.
- **2P Local Duel** — two players, one keyboard (or two gamepads).

## Running locally

No build step required — it's static files. Any static server works:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Or just open `index.html` directly in a browser.

## Project structure

```
index.html        Menu / HUD shell, canvas, Three.js import map
style.css         Menu and HUD styling
src/
  main.js         Scene/renderer/camera setup, game loop, state machine, input wiring, AI
  player.js       3D player physics, weapon spring simulation (vector-based), hit detection
  character.js    Builds the stylized low-poly duelist mesh + weapon
  arena.js        3D stage geometry, sky, mountains, lighting
  effects.js      Weapon trails, hit sparks, ambient dust particles
  input.js        Keyboard / mouse / gamepad input handling
  utils.js        Small math helpers (2D and 3D)
```

## License

MIT — see [LICENSE](LICENSE).
