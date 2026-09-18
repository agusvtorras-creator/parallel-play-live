# Parallel Play Live

A real-time classroom game for practicing parallelism in English writing.
One person hosts on a projector or laptop; students join on their own
phones with a 4-letter room code — no accounts, no app installs.

**Two modes:**
- **Speed Quiz** — timed multiple choice (Kahoot-style). Faster + correct
  answers score more points.
- **Write & Vote** — everyone gets the same broken sentence, writes their
  own fix, then votes on everyone else's fix (never their own). Points come
  from votes received. Answers are shown anonymized until after voting.

---

## Run it locally first (recommended)

You'll need [Node.js](https://nodejs.org) 18 or newer installed.

```bash
cd parallel-play-live
npm install
npm start
```

Then open **http://localhost:3000** in a browser. Click "I'm the host" in
one tab, and "I'm a player" in another tab (or on your phone, using your
computer's local IP address instead of `localhost`) to try a full game
with yourself before using it in class.

---

## Deploy to Render (so students can join from their own phones)

1. **Push this folder to a GitHub repository.** If you don't already have
   one, create a new repo on GitHub and push these files to it (including
   `package.json` and `server.js` — `.gitignore` already excludes
   `node_modules`).

2. **In the Render dashboard:** click **New → Web Service**, and connect
   the GitHub repo you just created.

3. **Configure the service:**
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free is fine for a single classroom game

4. Click **Create Web Service**. Render will build and deploy it, then
   give you a public URL like `https://your-app-name.onrender.com`.

5. **On game day:**
   - You open `https://your-app-name.onrender.com/host.html` and project it.
   - Students open `https://your-app-name.onrender.com/player.html` on
     their own phones and type in the room code shown on your screen.

That's it — no Firebase project, no API keys, no extra setup.

### One thing to know about Render's free tier

Free web services on Render "spin down" after a period of inactivity, so
the very first request after a while can take 20–30 seconds to wake back
up. **Open the host page a minute or two before class starts** so it's
already warm when students join. Once it's awake, everything runs
instantly for the rest of the session.

---

## How the game works, technically

- `server.js` runs an Express server that serves the `public/` folder and
  runs a Socket.io server for real-time messages between the host and
  players.
- Game state (rooms, players, scores, current question/round) lives in
  memory on the server — there's no database. This means:
  - Any number of separate games (rooms) can run at once, each with its
    own 4-letter code.
  - If the server restarts (e.g., Render redeploys, or the free instance
    spins down mid-game), all active games are lost. For a single class
    period this isn't a practical concern, since the whole game usually
    takes well under Render's free-tier inactivity window once it's awake.
  - If a student's phone loses connection mid-game, they'll need to
    rejoin as a new player (their previous score won't carry over). This
    is a reasonable trade-off for how rarely it happens in a single class
    session, but worth knowing about.

---

## Customizing the content

All the quiz questions and "fix this sentence" prompts live near the top
of `server.js`, in the `QUIZ_ITEMS` and `TEAM_PROMPTS` arrays. Each is a
plain JavaScript object — edit the text, add new ones, or remove ones you
don't want. No other code needs to change:

```js
// Add a new quiz question:
{ q: "Which is correct?",
  options: ["Correct version.", "Wrong version A.", "Wrong version B.", "Wrong version C."],
  correct: 0,   // index of the correct option in the array above
  explain: "One sentence on why the correct one is parallel." }

// Add a new Write & Vote prompt:
{ broken: "A sentence with a parallelism mistake.",
  fix: "The corrected version.",
  focus: "One short phrase naming the grammar point." }
```

You can also adjust `QUIZ_TIME_LIMIT` near the top of `server.js` (in
seconds) to make the Speed Quiz faster or slower.
