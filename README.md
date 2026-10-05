# Our Story

A private, two-sided storybook dashboard for sani and tharu. It opens on a glowing
login orb with your photos dissolving around it, then leads into a flip-page
book with a "her" side and a "his" side, plus a separate Game Room.

No build step, no framework, no server-side code — plain HTML, CSS and JS,
loaded straight in the browser. Data (stories, notes, photos, settings) is
saved to `localStorage`, so it lives only on the device and browser it was
entered on.

## Project structure

```
our-story/
├── index.html          entry point; wires up the CSS and JS below
├── css/
│   ├── style.css        shared tokens, layout shell, modal/toast, floating music player
│   ├── login.css        the aura-orb login screen and floating photos
│   ├── book.css         the flip-book: covers, pages, bookmarks, stories, photos, notes
│   └── games.css        the Game Room screen and every mini-game's styling
├── js/
│   ├── helpers.js        small pure utilities ($, esc, uid, shuffle, dates, safeUrl...)
│   ├── data.js           localStorage read/write, the `db` model, and its defaults
│   ├── book.js           the book engine: page building, page-flip animation, navigation
│   ├── games.js          the Game Room and every game (Memory Match, Would You Rather,
│   │                     Love Quiz, Catch the Hearts, Scratch & Reveal, Spin the Wheel,
│   │                     Hearts vs Stars, Quick Draw, Ask the Aura)
│   └── app.js            login flow, modals, event wiring, and startup
├── package.json
└── .gitignore
```

The five `js/*.js` files are loaded as plain scripts (no bundler, no modules)
in the order listed in `index.html`. They share one global scope on purpose —
`helpers.js` and `data.js` must load before `book.js` and `games.js`, which
must load before `app.js`.

## Running it locally

No installation is required — you can just open `index.html` in a browser.
For a local dev server instead (recommended, since some browsers restrict
`localStorage` on `file://` pages):

```bash
npm start
```

This runs a static file server at http://localhost:5173 via `npx serve`,
no install step needed.

## Notes

- The login "secret word" is a shared passphrase for the mood of the page,
  not real security — do not put anything sensitive in here.
- Photos, movie posters, and date pictures are all resized client-side and
  stored as base64 in `localStorage`, so there's a practical limit (a few
  dozen images) before the browser's storage quota is reached.
- The Spotify player embeds a specific playlist by ID; swap the iframe `src`
  in `index.html` to change it.
