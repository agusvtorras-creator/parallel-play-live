// Parallel Play Live — real-time classroom game server.
// Two modes: Speed Quiz (timed multiple choice) and Write & Vote (Jackbox-style).

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

const QUIZ_TIME_LIMIT = 20; // seconds per question

// ---------------------------------------------------------------------------
// Content — edit these arrays to change what students practice.
// Each quiz item's `correct` index refers to the ORIGINAL options order below;
// options are shuffled fresh for every game, so don't rely on position.
// ---------------------------------------------------------------------------

const QUIZ_ITEMS = [
  { q: "Which sentence is correctly parallel?",
    options: ["She likes hiking, swimming, and reading.", "She likes hiking, to swim, and reading.", "She likes to hike, swimming, and read.", "She likes hiking, swim, and reading."],
    correct: 0, explain: "All three items after \"likes\" must share the same form — here, gerunds (hiking, swimming, reading)." },
  { q: "Which is correct?",
    options: ["Not only did he arrive late, but he also forgot the documents.", "Not only he arrived late, but also he forgot the documents.", "Not only arriving late, but also forgot the documents.", "Not only late arrival, but also forgetting documents."],
    correct: 0, explain: "\"Not only... but also\" needs matching structure on both sides — here, an inverted clause on each side." },
  { q: "Fix: \"He decided to leave and saying goodbye.\"",
    options: ["He decided to leave and to say goodbye.", "He decided leaving and to say goodbye.", "He decided to leave and said goodbye quickly.", "He decided leave and saying goodbye."],
    correct: 0, explain: "\"Decided\" takes an infinitive — both items after it should be \"to + verb.\"" },
  { q: "Which is correct?",
    options: ["While cooking, she listened to music.", "While cooking, the phone rang.", "While she cooking, the phone rang.", "While to cook, she listened to music."],
    correct: 0, explain: "A reduced clause (no subject) only works when the dropped subject matches the main clause's subject — here, \"she\" is cooking AND listening." },
  { q: "Fix: \"Despite he was tired, he kept working.\"",
    options: ["Despite being tired, he kept working.", "Despite he tired, he kept working.", "Despite to be tired, he kept working.", "Despite tired, he kept working."],
    correct: 0, explain: "\"Despite\" is a preposition — it takes a noun or gerund, never a full clause with a subject." },
  { q: "Which is correct?",
    options: ["The trip was both relaxing and educational.", "The trip was both relaxing and it educated us.", "The trip both was relaxing and educational.", "The trip was both relax and educational."],
    correct: 0, explain: "\"Both... and\" needs the same grammatical piece on each side — here, two adjectives." },
  { q: "Which is correct?",
    options: ["She cooked at home in order to save money.", "She cooked at home in order to saving money.", "She cooked at home in order saving money.", "She cooked at home in order that save money."],
    correct: 0, explain: "\"In order to\" is always followed by the base form of the verb (an infinitive)." },
  { q: "Fix: \"Studies show that diet matters and to sleep matters too.\"",
    options: ["Studies show that diet matters and that sleep matters too.", "Studies show diet matters and sleeping matters too.", "Studies show that diet matter and sleep matters too.", "Studies show diet mattering and sleep matters too."],
    correct: 0, explain: "\"Show\" here takes \"that\" clauses — keep both items as \"that + subject + verb.\"" },
  { q: "Which is correct?",
    options: ["While she was cooking, he set the table.", "While cooking, he set the table.", "While she cooking, he set the table.", "While to cook, he set the table."],
    correct: 0, explain: "The two clauses have different subjects (\"she\" and \"he\"), so the connector needs a full clause — you can't drop the subject." },
  { q: "Which is correct?",
    options: ["She wanted either to leave now or to stay until morning.", "She wanted either to leave now or staying until morning.", "She either wanted to leave now or stay until morning.", "She wanted to either leaving now or stay until morning."],
    correct: 0, explain: "\"Either... or\" needs the same form on both sides — here, two infinitives." },
  { q: "Which is correct?",
    options: ["The report was clear, concise, and convincing.", "The report was clear, concise, and it convinced everyone.", "The report was clearly, concise, and convincing.", "The report was clear, concisely, and convincing."],
    correct: 0, explain: "All three items describing the report should be adjectives of the same type." },
  { q: "Which is correct?",
    options: ["He neither called nor texted.", "He neither called nor did he text.", "He didn't neither call nor text.", "He neither called or texted."],
    correct: 0, explain: "\"Neither... nor\" pairs two matching verb forms — and never combines with another negative like \"didn't.\"" },
  { q: "Fix: \"My hobbies are reading, to cook, and painting.\"",
    options: ["My hobbies are reading, cooking, and painting.", "My hobbies are to read, cooking, and painting.", "My hobbies are reading, cook, and painting.", "My hobbies are to read, to cook, and painting."],
    correct: 0, explain: "All three hobbies should be gerunds to match \"reading\" and \"painting.\"" },
  { q: "Fix: \"The manager asked us to be punctual, to work hard, and being honest.\"",
    options: ["The manager asked us to be punctual, to work hard, and to be honest.", "The manager asked us being punctual, to work hard, and to be honest.", "The manager asked us to be punctual, working hard, and to be honest.", "The manager asked us punctual, to work hard, and being honest."],
    correct: 0, explain: "All three items should be infinitives, matching \"to be punctual\" and \"to work hard.\"" },
  { q: "Which is correct?",
    options: ["Not only is the food expensive, but it is also unhealthy.", "Not only the food is expensive, but also it is unhealthy.", "Not only expensive is the food, but also being unhealthy.", "Not only the food expensive, but also unhealthy."],
    correct: 0, explain: "Both halves of \"not only... but also\" use an inverted clause (verb before subject) here — matching structure on each side." },
  { q: "Which is correct?",
    options: ["Whether to cook or to order food, you should plan ahead.", "Whether cooking or to order food, you should plan ahead.", "Whether to cook or ordering food, you should plan ahead.", "Whether cook or order food, you should plan ahead."],
    correct: 0, explain: "\"Whether... or\" needs matching forms on both sides — here, two infinitives." }
];

const TEAM_PROMPTS = [
  { broken: "I prefer to cook something by myself rather than spent money in something already prepared.",
    fix: "I prefer to cook something by myself rather than to spend money on something already prepared.",
    focus: "Infinitive parallel after \"rather than\"" },
  { broken: "Nowadays people prefer buy fast food than waste time cooking meals for themselves.",
    fix: "Nowadays people prefer buying fast food to wasting time cooking meals for themselves.",
    focus: "Gerund parallel with \"prefer... to...\"" },
  { broken: "The report was clear, concise, and it convinced everyone.",
    fix: "The report was clear, concise, and convincing.",
    focus: "Adjective list parallel" },
  { broken: "Despite he was tired, he kept working.",
    fix: "Although he was tired, he kept working. / Despite being tired, he kept working.",
    focus: "\"Despite\" + gerund/noun, never a clause" },
  { broken: "While cooking, the phone rang.",
    fix: "While she was cooking, the phone rang. / While cooking, she heard the phone ring.",
    focus: "Dangling modifier — subject must match" },
  { broken: "The workshop will help you plan projects, manage time, and how to communicate clearly.",
    fix: "The workshop will help you plan projects, manage time, and communicate clearly.",
    focus: "Base-verb list after \"help you\"" },
  { broken: "The manager asked us to be punctual, to work hard, and being honest.",
    fix: "The manager asked us to be punctual, to work hard, and to be honest.",
    focus: "Infinitive parallel in a list" },
  { broken: "My hobbies are reading, to cook, and painting.",
    fix: "My hobbies are reading, cooking, and painting.",
    focus: "Gerund parallel in a list" },
  { broken: "It is important to study hard, practicing daily, and to ask questions.",
    fix: "It is important to study hard, practice daily, and ask questions.",
    focus: "Bare-infinitive list after \"it is important to\"" },
  { broken: "She either wanted to leave now or staying until morning.",
    fix: "She wanted either to leave now or to stay until morning.",
    focus: "\"Either... or\" parallel" }
];

// ---------------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------------

const rooms = new Map(); // code -> room object

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function connectedPlayerIds(room) {
  return Object.keys(room.players);
}

function leaderboard(room) {
  return Object.entries(room.players)
    .map(([id, p]) => ({ id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score);
}

function playersList(room) {
  return Object.entries(room.players).map(([id, p]) => ({ id, name: p.name, score: p.score }));
}

function broadcastPlayers(room) {
  io.to(room.code).emit('room:update', { players: playersList(room) });
}

// ---------------------------------------------------------------------------
// Quiz mode
// ---------------------------------------------------------------------------

function startQuizMode(room) {
  room.mode = 'quiz';
  room.quiz = {
    order: shuffle(QUIZ_ITEMS.map((_, i) => i)),
    index: -1,
    phase: 'lobby'
  };
  io.to(room.code).emit('mode:started', { mode: 'quiz', total: room.quiz.order.length });
  startQuizQuestion(room);
}

function startQuizQuestion(room) {
  room.quiz.index++;
  if (room.quiz.index >= room.quiz.order.length) {
    room.quiz.phase = 'final';
    io.to(room.code).emit('quiz:final', { leaderboard: leaderboard(room) });
    return;
  }
  const item = QUIZ_ITEMS[room.quiz.order[room.quiz.index]];
  const idxs = shuffle([0, 1, 2, 3]);
  room.quiz.currentCorrect = idxs.indexOf(item.correct);
  room.quiz.currentOptions = idxs.map(i => item.options[i]);
  room.quiz.currentExplain = item.explain;
  room.quiz.answers = {};
  room.quiz.startTime = Date.now();
  room.quiz.phase = 'question';

  io.to(room.code).emit('quiz:question', {
    index: room.quiz.index,
    total: room.quiz.order.length,
    q: item.q,
    options: room.quiz.currentOptions,
    timeLimit: QUIZ_TIME_LIMIT
  });

  clearTimeout(room.quiz.timer);
  room.quiz.timer = setTimeout(() => revealQuiz(room), QUIZ_TIME_LIMIT * 1000 + 500);
}

function revealQuiz(room) {
  if (room.quiz.phase !== 'question') return;
  room.quiz.phase = 'reveal';
  clearTimeout(room.quiz.timer);

  const results = [];
  for (const [pid, player] of Object.entries(room.players)) {
    const ans = room.quiz.answers[pid];
    let points = 0;
    let correct = false;
    if (ans) {
      correct = ans.choice === room.quiz.currentCorrect;
      if (correct) {
        const speedFrac = Math.max(0, 1 - ans.elapsed / (QUIZ_TIME_LIMIT * 1000));
        points = Math.round(800 + 200 * speedFrac);
      }
    }
    player.score += points;
    results.push({ id: pid, name: player.name, correct, points, answered: !!ans, total: player.score });
  }
  results.sort((a, b) => b.total - a.total);

  io.to(room.code).emit('quiz:reveal', {
    correctIndex: room.quiz.currentCorrect,
    explain: room.quiz.currentExplain,
    results
  });
}

// ---------------------------------------------------------------------------
// Write & Vote mode
// ---------------------------------------------------------------------------

function startTeamMode(room) {
  room.mode = 'team';
  room.team = {
    order: shuffle(TEAM_PROMPTS.map((_, i) => i)),
    round: -1,
    phase: 'lobby'
  };
  io.to(room.code).emit('mode:started', { mode: 'team', total: room.team.order.length });
  startTeamRound(room);
}

function startTeamRound(room) {
  room.team.round++;
  if (room.team.round >= room.team.order.length) {
    room.team.phase = 'final';
    io.to(room.code).emit('team:final', { leaderboard: leaderboard(room) });
    return;
  }
  const item = TEAM_PROMPTS[room.team.order[room.team.round]];
  room.team.current = item;
  room.team.submissions = {};
  room.team.votes = {};
  room.team.phase = 'writing';

  io.to(room.code).emit('team:prompt', {
    round: room.team.round,
    total: room.team.order.length,
    broken: item.broken
  });
}

function moveToVoting(room) {
  if (room.team.phase !== 'writing') return;
  room.team.phase = 'voting';

  const subsList = Object.entries(room.team.submissions).map(([pid, text]) => ({ id: pid, text }));
  room.team.subsList = shuffle(subsList);

  for (const pid of connectedPlayerIds(room)) {
    const optionsForPlayer = room.team.subsList.filter(s => s.id !== pid);
    io.to(pid).emit('team:vote', { options: optionsForPlayer });
  }
  io.to(room.hostId).emit('team:votingStarted', { count: subsList.length });
}

function revealTeamResults(room) {
  if (room.team.phase !== 'voting') return;
  room.team.phase = 'results';

  const tally = {};
  Object.values(room.team.votes).forEach(targetId => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  const results = room.team.subsList.map(s => {
    const votes = tally[s.id] || 0;
    const player = room.players[s.id];
    if (player) player.score += votes;
    return { id: s.id, text: s.text, votes, name: player ? player.name : 'A player who left' };
  }).sort((a, b) => b.votes - a.votes);

  io.to(room.code).emit('team:results', {
    results,
    fix: room.team.current.fix,
    focus: room.team.current.focus,
    leaderboard: leaderboard(room)
  });
}

// ---------------------------------------------------------------------------
// Socket handlers
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {

  socket.on('host:create', () => {
    const code = generateCode();
    const room = { code, hostId: socket.id, players: {}, mode: null };
    rooms.set(code, room);
    socket.join(code);
    socket.data.role = 'host';
    socket.data.roomCode = code;
    socket.emit('host:created', { code });
  });

  socket.on('player:join', ({ code, name }) => {
    code = (code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('player:joinError', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    const cleanName = (name || 'Player').trim().slice(0, 20) || 'Player';
    room.players[socket.id] = { name: cleanName, score: 0 };
    socket.join(code);
    socket.data.role = 'player';
    socket.data.roomCode = code;
    socket.emit('player:joined', { code, name: cleanName });
    broadcastPlayers(room);
  });

  socket.on('host:startMode', ({ mode }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || socket.id !== room.hostId) return;
    if (mode === 'quiz') startQuizMode(room);
    else if (mode === 'team') startTeamMode(room);
  });

  socket.on('host:next', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || socket.id !== room.hostId) return;
    if (room.mode === 'quiz') startQuizQuestion(room);
    else if (room.mode === 'team') startTeamRound(room);
  });

  socket.on('host:forceAdvance', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || socket.id !== room.hostId) return;
    if (room.mode === 'quiz' && room.quiz.phase === 'question') revealQuiz(room);
    else if (room.mode === 'team' && room.team.phase === 'writing') moveToVoting(room);
    else if (room.mode === 'team' && room.team.phase === 'voting') revealTeamResults(room);
  });

  socket.on('player:quizAnswer', ({ choice }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.mode !== 'quiz' || room.quiz.phase !== 'question') return;
    if (room.quiz.answers[socket.id]) return;
    const elapsed = Date.now() - room.quiz.startTime;
    room.quiz.answers[socket.id] = { choice, elapsed };
    io.to(room.hostId).emit('quiz:answerCount', { count: Object.keys(room.quiz.answers).length, total: connectedPlayerIds(room).length });
    if (Object.keys(room.quiz.answers).length >= connectedPlayerIds(room).length) {
      revealQuiz(room);
    }
  });

  socket.on('player:submitFix', ({ text }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.mode !== 'team' || room.team.phase !== 'writing') return;
    if (room.team.submissions[socket.id] !== undefined) return;
    room.team.submissions[socket.id] = (text || '').trim().slice(0, 300) || '(no answer)';
    io.to(room.hostId).emit('team:submitCount', { count: Object.keys(room.team.submissions).length, total: connectedPlayerIds(room).length });
    if (Object.keys(room.team.submissions).length >= connectedPlayerIds(room).length) {
      moveToVoting(room);
    }
  });

  socket.on('player:vote', ({ targetId }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.mode !== 'team' || room.team.phase !== 'voting') return;
    if (room.team.votes[socket.id]) return;
    if (targetId === socket.id) return;
    room.team.votes[socket.id] = targetId;
    io.to(room.hostId).emit('team:voteCount', { count: Object.keys(room.team.votes).length, total: connectedPlayerIds(room).length });
    if (Object.keys(room.team.votes).length >= connectedPlayerIds(room).length) {
      revealTeamResults(room);
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    if (socket.data.role === 'host') {
      io.to(code).emit('host:disconnected');
      clearTimeout(room.quiz && room.quiz.timer);
      rooms.delete(code);
    } else if (socket.data.role === 'player') {
      delete room.players[socket.id];
      broadcastPlayers(room);
      // If everyone remaining has already answered/submitted/voted, an in-progress
      // round can advance now that the denominator has shrunk.
      if (room.mode === 'quiz' && room.quiz && room.quiz.phase === 'question') {
        if (Object.keys(room.quiz.answers).length >= connectedPlayerIds(room).length) revealQuiz(room);
      }
      if (room.mode === 'team' && room.team) {
        if (room.team.phase === 'writing' && Object.keys(room.team.submissions).length >= connectedPlayerIds(room).length) moveToVoting(room);
        if (room.team.phase === 'voting' && Object.keys(room.team.votes).length >= connectedPlayerIds(room).length) revealTeamResults(room);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Parallel Play Live running on port ${PORT}`);
});
