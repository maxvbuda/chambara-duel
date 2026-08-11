# Chambara Duel

A browser-based, physics-driven weapon duel inspired by *1-2-Switch*'s **Chambara** minigame — swing your weapon like a Joy-Con, knock your rival off the platform, first to score wins.

Pure vanilla HTML5 canvas + JavaScript, no build step, no dependencies. Open `index.html` or serve the folder statically and play.

▶️ **[Play it live](https://maxvbuda.github.io/chambara-duel/)**

## How it works

There's no "attack" button. Your weapon is spring-mounted to your hand and always chases wherever you're aiming — move the mouse (or a stick) in an arc and the weapon swings with real angular velocity. Swing fast enough and it becomes a live hit; the faster the swing, the harder the knockback. It's the same physical, motion-control feel as the original Joy-Con game, translated to mouse/keyboard/gamepad.

Get knocked off the floating platform and your opponent scores a point. First to the target score (3/5/7, selectable in the menu) wins the match.

## Controls

**Player 1**
- `A` / `D` — move
- `W` — jump
- Mouse — aim & swing your weapon
- `Shift` — brace (block, cancels most knockback)

**Player 2** *(or CPU in 1P mode)*
- `←` / `→` — move
- `↑` — jump
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
index.html        Menu / HUD / canvas shell
style.css         Menu and HUD styling
src/
  main.js         Game loop, state machine, input wiring, AI, rendering
  player.js        Player physics, weapon spring simulation, hit detection
  arena.js         Stage geometry and background rendering
  input.js         Keyboard / mouse / gamepad input handling
  utils.js         Small math helpers
```

## License

MIT — see [LICENSE](LICENSE).
