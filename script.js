const SIZE = 15;
const DAY_MS = 86400000;
const ARCHIVE_START = new Date(2026, 0, 1);
const ARCHIVE_KEY = "bostonian-word-links-archive-v1";
const START_WORDS = [
  "HARBOR", "COMMON", "BRICK", "WATER", "BEACON", "GARDEN", "RIVER", "MARKET",
  "PUBLIC", "LIBRARY", "AUTUMN", "SUBWAY", "BOSTON", "COFFEE", "MUSEUM", "BRIDGE",
  "PARK", "STREET", "SCHOOL", "PLANET", "CANDLE", "WINDOW", "POCKET", "CASTLE",
  "FOREST", "SILVER", "SUMMER", "WINTER", "ORANGE", "PURPLE", "JOURNAL", "ROCKET",
  "ISLAND", "BASKET", "FRIEND", "MORNING", "BREEZE", "CAMERA", "BUTTON", "THUNDER"
];

const boardEl = document.querySelector("#board");
const input = document.querySelector("#wordInput");
const messageEl = document.querySelector("#message");
const scoreEl = document.querySelector("#score");
const wordCountEl = document.querySelector("#wordCount");
const bestScoreEl = document.querySelector("#bestScore");
const placeButton = document.querySelector("#placeButton");
const matchPositionEl = document.querySelector("#matchPosition");
const costPreview = document.querySelector("#costPreview");
const winDialog = document.querySelector("#winDialog");
const archiveDialog = document.querySelector("#archiveDialog");

let grid, words, selected, matchChoice, score, started;
let selectedDate = startOfDay(new Date());
let calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function utcDay(date) { return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS); }
function dateSeed(date = selectedDate) { return utcDay(date); }
function dateKey(date = selectedDate) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function puzzleForDate(date) {
  const seed = dateSeed(date);
  const first = Math.abs(Math.imul(seed, 2654435761)) % START_WORDS.length;
  let second = Math.abs(Math.imul(seed + 97, 1597334677)) % START_WORDS.length;
  if (second === first) second = (second + 13) % START_WORDS.length;
  return { a: START_WORDS[first], b: START_WORDS[second] };
}

function puzzleNumber(date = selectedDate) {
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(ARCHIVE_START.getFullYear(), ARCHIVE_START.getMonth(), ARCHIVE_START.getDate())) / DAY_MS) + 1;
}

function init(date = selectedDate) {
  selectedDate = startOfDay(date);
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  words = [];
  selected = null; matchChoice = 0; score = 0; started = false;
  const pair = puzzleForDate(selectedDate);
  addWord(pair.a, 2, 1, "H", true);
  addWord(pair.b, 10, SIZE - pair.b.length - 1, "H", true);
  buildBoard(); updateStats(); resetEntry();
  document.querySelector("#startScreen").classList.remove("hidden");
  document.querySelector("#boardCaption").textContent = "Select a gold letter to begin.";
  message("", false);
  const today = new Date();
  document.querySelector("#todayDate").textContent = today.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  document.querySelector("#puzzleDate").textContent = selectedDate.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
  document.querySelector("#puzzleNumber").textContent = `No. ${String(puzzleNumber()).padStart(3,"0")}`;
  document.querySelector("#startEyebrow").textContent = dateKey(selectedDate) === dateKey(startOfDay(today)) ? "Today’s puzzle" : "From the archive";
}

function addWord(text, row, col, direction, starter = false) {
  const word = { id: words.length, text, row, col, direction, starter };
  words.push(word);
  for (let i = 0; i < text.length; i++) {
    const r = row + (direction === "V" ? i : 0);
    const c = col + (direction === "H" ? i : 0);
    if (!grid[r][c]) grid[r][c] = { letter: text[i], wordIds: [] };
    grid[r][c].wordIds.push(word.id);
  }
}

function buildBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const cell = document.createElement("button");
    cell.className = "cell"; cell.type = "button";
    cell.dataset.row = r; cell.dataset.col = c; cell.setAttribute("role", "gridcell");
    const data = grid[r][c];
    if (data) {
      cell.textContent = data.letter; cell.classList.add("filled");
      if (data.wordIds.some(id => words[id].starter)) cell.classList.add("start-word");
      if (words.length > 2 && data.wordIds.includes(words.length - 1)) cell.classList.add("newly-placed");
      cell.setAttribute("aria-label", `${data.letter}, row ${r + 1}, column ${c + 1}`);
    } else cell.setAttribute("aria-label", `Empty, row ${r + 1}, column ${c + 1}`);
    cell.addEventListener("click", () => selectCell(r, c));
    boardEl.appendChild(cell);
  }
}

function selectCell(row, col) {
  if (!started || !grid[row][col]) return;
  selected = { row, col, letter: grid[row][col].letter };
  const crossingDirections = [...new Set(grid[row][col].wordIds.map(id => words[id].direction))];
  if (crossingDirections.length === 1) {
    const nextDirection = crossingDirections[0] === "H" ? "V" : "H";
    document.querySelector(`input[name="direction"][value="${nextDirection}"]`).checked = true;
  }
  matchChoice = 0;
  input.disabled = false; input.placeholder = `WORD WITH ${selected.letter}`; input.focus();
  document.querySelector("#boardCaption").textContent = `${selected.letter} selected — type a word containing ${selected.letter}.`;
  message(`Good. Now type a word that contains ${selected.letter}.`, true);
  renderPreview();
}

function normalizedWord() { return input.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, SIZE); }
function matchingIndexes(word) {
  if (!selected) return [];
  return [...word].map((letter, i) => letter === selected.letter ? i : -1).filter(i => i >= 0);
}

function candidate() {
  const text = normalizedWord();
  const matches = matchingIndexes(text);
  if (!matches.length) return null;
  matchChoice = (matchChoice + matches.length) % matches.length;
  const index = matches[matchChoice];
  const direction = document.querySelector('input[name="direction"]:checked').value;
  return { text, direction, index, row: selected.row - (direction === "V" ? index : 0), col: selected.col - (direction === "H" ? index : 0) };
}

function cellsFor(move) {
  return [...move.text].map((letter, i) => ({ letter, row: move.row + (move.direction === "V" ? i : 0), col: move.col + (move.direction === "H" ? i : 0) }));
}

function validate(move) {
  if (!move || move.text.length < 2) return { ok:false, reason:`Use a word of at least 2 letters containing ${selected?.letter || "the selected letter"}.` };
  if (words.some(word => word.text === move.text)) return { ok:false, reason:"That word is already on the board." };
  if (!window.WORD_LINKS_DICTIONARY?.has(move.text.toLowerCase())) return { ok:false, reason:`“${move.text}” is not in the English dictionary. Try another word.` };
  const cells = cellsFor(move);
  if (cells.some(cell => cell.row < 0 || cell.row >= SIZE || cell.col < 0 || cell.col >= SIZE)) return { ok:false, reason:"That word runs off the edge of the board." };
  const crossedWordIds = new Set();
  const crossingCounts = new Map();
  for (const cell of cells) {
    const existing = grid[cell.row][cell.col];
    if (existing && existing.letter !== cell.letter) return { ok:false, reason:"A letter conflicts with a tile already there." };
    if (existing) existing.wordIds.forEach(id => {
      crossedWordIds.add(id);
      crossingCounts.set(id, (crossingCounts.get(id) || 0) + 1);
    });
  }
  if ([...crossedWordIds].some(id => words[id].direction === move.direction || crossingCounts.get(id) !== 1)) return { ok:false, reason:"Words must cross at one letter, not overlap in the same direction." };
  // Prevent side-by-side letter touching, which would create accidental words.
  const ownCells = new Set(cells.map(cell => `${cell.row},${cell.col}`));
  for (const cell of cells) {
    if (grid[cell.row][cell.col]) continue;
    const sides = move.direction === "H" ? [[-1,0],[1,0]] : [[0,-1],[0,1]];
    for (const [dr,dc] of sides) if (grid[cell.row + dr]?.[cell.col + dc] && !ownCells.has(`${cell.row + dr},${cell.col + dc}`)) return { ok:false, reason:"Words cannot touch side-by-side. Leave a clear row or column." };
  }
  const before = move.direction === "H" ? [move.row, move.col - 1] : [move.row - 1, move.col];
  const after = move.direction === "H" ? [move.row, move.col + move.text.length] : [move.row + move.text.length, move.col];
  if (grid[before[0]]?.[before[1]] || grid[after[0]]?.[after[1]]) return { ok:false, reason:"Leave an empty tile before and after your word." };
  if (crossedWordIds.size === 0) return { ok:false, reason:"Your word must cross a word already on the board." };
  const groups = componentMap();
  const crossedGroups = new Set([...crossedWordIds].map(id => groups.get(id)));
  if (crossedWordIds.size > 1 && crossedGroups.size < 2) return { ok:false, reason:"A normal move must cross exactly one existing word." };
  if (crossedWordIds.size > 2) return { ok:false, reason:"That move crosses too many existing words." };
  return { ok:true };
}

function componentMap() {
  const graph = new Map(words.map(word => [word.id, new Set()]));
  grid.flat().filter(Boolean).forEach(cell => cell.wordIds.forEach(a => cell.wordIds.forEach(b => { if (a !== b) graph.get(a).add(b); })));
  const groups = new Map(); let group = 0;
  for (const word of words) if (!groups.has(word.id)) {
    const stack = [word.id]; groups.set(word.id, group);
    while (stack.length) for (const next of graph.get(stack.pop())) if (!groups.has(next)) { groups.set(next, group); stack.push(next); }
    group++;
  }
  return groups;
}

function renderPreview() {
  document.querySelectorAll(".cell").forEach(cell => {
    cell.classList.remove("selected","preview","conflict");
    if (!grid[Number(cell.dataset.row)][Number(cell.dataset.col)]) cell.textContent = "";
  });
  if (selected) getCell(selected.row, selected.col).classList.add("selected");
  const word = normalizedWord(); input.value = word;
  const matches = matchingIndexes(word);
  matchPositionEl.textContent = matches.length ? `${matches[matchChoice] + 1} of ${word.length}` : "—";
  costPreview.textContent = word ? `Cost: ${10 + word.length} points` : "Cost: 10 + 1 per letter";
  const move = candidate();
  if (move) cellsFor(move).forEach(cell => {
    const el = getCell(cell.row, cell.col); if (!el) return;
    el.classList.add(grid[cell.row][cell.col] && grid[cell.row][cell.col].letter !== cell.letter ? "conflict" : "preview");
    if (!grid[cell.row][cell.col]) el.textContent = cell.letter;
  });
  const result = move ? validate(move) : { ok:false };
  placeButton.disabled = !result.ok;
  if (move && !result.ok) message(result.reason, false);
  else if (move && result.ok) message("Looks good — the green preview fits.", true);
}

function placeWord(event) {
  event.preventDefault();
  const move = candidate(); const result = validate(move);
  if (!result.ok) { message(result.reason, false); return; }
  addWord(move.text, move.row, move.col, move.direction);
  score += 10 + move.text.length;
  buildBoard(); updateStats(); resetEntry();
  message(`${move.text} placed for ${10 + move.text.length} points.`, true);
  document.querySelector("#boardCaption").textContent = "Keep building toward the other gold word.";
  if (isConnected()) win();
}

function isConnected() {
  const starters = words.filter(word => word.starter);
  return componentMap().get(starters[0].id) === componentMap().get(starters[1].id);
}

function readArchive() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || {}; }
  catch { return {}; }
}

function saveArchive(data) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(data)); }

function recordCompletion() {
  const archive = readArchive();
  const key = dateKey();
  const previousBest = Number(archive[key]?.best) || Infinity;
  archive[key] = {
    completed: true,
    best: Math.min(previousBest, score),
    words: words.length - 2,
    completedAt: new Date().toISOString()
  };
  saveArchive(archive);
}

function sameDate(a, b) { return dateKey(a) === dateKey(b); }

function openArchive() {
  calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  renderCalendar();
  archiveDialog.showModal();
}

function renderCalendar() {
  const gridEl = document.querySelector("#calendarGrid");
  const archive = readArchive();
  const today = startOfDay(new Date());
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  document.querySelector("#calendarMonth").textContent = calendarCursor.toLocaleDateString("en-US", { month:"long", year:"numeric" });
  document.querySelector("#archiveCompleted").textContent = Object.values(archive).filter(record => record?.completed).length;
  const previousButton = document.querySelector("#previousMonth");
  const nextButton = document.querySelector("#nextMonth");
  previousButton.disabled = year === ARCHIVE_START.getFullYear() && month === ARCHIVE_START.getMonth();
  nextButton.disabled = year === today.getFullYear() && month === today.getMonth();
  gridEl.innerHTML = "";

  for (let slot = 0; slot < 42; slot++) {
    const dayNumber = slot - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      const empty = document.createElement("span");
      empty.className = "calendar-empty";
      empty.setAttribute("aria-hidden", "true");
      gridEl.appendChild(empty);
      continue;
    }
    const day = new Date(year, month, dayNumber);
    const key = dateKey(day);
    const record = archive[key];
    const isFuture = day > today;
    const isBeforeArchive = day < ARCHIVE_START;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.innerHTML = `<span>${dayNumber}</span>${record?.completed ? '<i aria-hidden="true">✓</i>' : ""}`;
    button.disabled = isFuture || isBeforeArchive;
    if (sameDate(day, today)) button.classList.add("today");
    if (sameDate(day, selectedDate)) button.classList.add("selected");
    if (record?.completed) button.classList.add("completed");
    const label = `${day.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}${record?.completed ? `, completed with a best score of ${record.best}` : isFuture ? ", locked" : ", available"}`;
    button.setAttribute("aria-label", label);
    button.title = record?.completed ? `Best score: ${record.best}` : "Play this puzzle";
    button.addEventListener("click", () => {
      init(day);
      archiveDialog.close();
      document.querySelector("#game").scrollIntoView({ behavior:"smooth", block:"start" });
      setTimeout(() => document.querySelector("#startButton").focus(), 350);
    });
    gridEl.appendChild(button);
  }
}

function win() {
  document.querySelectorAll(".filled").forEach((cell, i) => setTimeout(() => cell.classList.add("connected"), i * 10));
  const added = words.length - 2;
  document.querySelector("#finalWords").textContent = `${added} ${added === 1 ? "word" : "words"}`;
  document.querySelector("#finalScore").textContent = `${score} points`;
  recordCompletion();
  updateStats(); setTimeout(() => winDialog.showModal(), 550);
}

function updateStats() {
  scoreEl.textContent = score; wordCountEl.textContent = Math.max(0, words.length - 2);
  bestScoreEl.textContent = readArchive()[dateKey()]?.best || "—";
}
function resetEntry() { selected = null; input.value = ""; input.disabled = true; input.placeholder = "SELECT A TILE"; placeButton.disabled = true; matchPositionEl.textContent = "—"; costPreview.textContent = "Each word costs 10 + 1 per letter"; }
function message(text, success) { messageEl.textContent = text; messageEl.classList.toggle("success", success); }
function getCell(row,col) { return boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`); }
function start() { started = true; document.querySelector("#startScreen").classList.add("hidden"); document.querySelector("#boardCaption").textContent = "Step 1: select any filled letter on the board."; }

input.addEventListener("input", () => { matchChoice = 0; renderPreview(); });
document.querySelectorAll('input[name="direction"]').forEach(radio => radio.addEventListener("change", renderPreview));
document.querySelector("#previousMatch").addEventListener("click", () => { matchChoice--; renderPreview(); });
document.querySelector("#nextMatch").addEventListener("click", () => { matchChoice++; renderPreview(); });
document.querySelector("#clearButton").addEventListener("click", () => { input.value = ""; renderPreview(); input.focus(); });
document.querySelector("#wordForm").addEventListener("submit", placeWord);
document.querySelector("#startButton").addEventListener("click", start);
document.querySelector("#replayButton").addEventListener("click", () => init(selectedDate));
document.querySelector("#playAgainButton").addEventListener("click", () => { winDialog.close(); init(selectedDate); start(); });
document.querySelector("#archiveButton").addEventListener("click", openArchive);
document.querySelector("#archiveLink").addEventListener("click", openArchive);
document.querySelector("#winArchiveButton").addEventListener("click", () => { winDialog.close(); openArchive(); });
document.querySelector("#closeArchive").addEventListener("click", () => archiveDialog.close());
document.querySelector("#previousMonth").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderCalendar(); });
document.querySelector("#nextMonth").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderCalendar(); });
document.querySelector("#helpButton").addEventListener("click", () => document.querySelector("#helpDialog").showModal());
document.querySelector("#closeHelp").addEventListener("click", () => document.querySelector("#helpDialog").close());
document.querySelector("#gotItButton").addEventListener("click", () => document.querySelector("#helpDialog").close());
document.querySelector("#menuButton").addEventListener("click", () => document.querySelector("#sectionNav").classList.toggle("open"));
document.querySelector("#shareButton").addEventListener("click", async () => {
  const result = `Word Links ${document.querySelector("#puzzleNumber").textContent} · ${selectedDate.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}\n${score} points · ${words.length - 2} words\n🔗 The Bostonian Times`;
  try { await navigator.clipboard.writeText(result); document.querySelector("#shareStatus").textContent = "Result copied to clipboard."; }
  catch { document.querySelector("#shareStatus").textContent = "Copy unavailable in this browser."; }
});

init();
