# Carom

A browser paddle duel about spin and bank shots. Slide into a return to curve the ball, and use two swaying, rotating obstacles to find unexpected angles. Play against the AI or share a keyboard. First to 11 wins, with a two-point lead.

Install with `npm ci`. Run `npm run dev` for development. Run `npm run build` to produce the complete static site in `dist/`, then serve that directory on any static host. `npm run preview` previews the production build.

Use W/S for the left paddle and the arrow keys for the right. In Solo, either pair controls your paddle. Use either pair to select menu items and Enter or Space to confirm; menus also accept mouse and touch. P or Escape pauses and resumes. M toggles sound. Backquote toggles the engine's diagnostics. Touch controls appear when using a touchscreen.

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` check the implementation. The simulation and automation API live in `src/game.ts`; drawing lives in `src/render.ts`. All graphics and audio are generated in code, with no runtime downloads.
