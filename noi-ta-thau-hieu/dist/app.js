const $ = (selector) => document.querySelector(selector);
const screens = Object.fromEntries(['intro', 'library', 'guide', 'play'].map(id => [id, document.getElementById(id)]));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const BASE_CATEGORIES = ['Tất cả', 'Trải lòng', 'Drinking', 'Thật hay thách'];
const SETTINGS_KEY = 'noi-ta-thau-hieu.settings.v1';
const PROGRESS_PREFIX = 'noi-ta-thau-hieu.progress.v1.';
const defaultSettings = { mode: 'stop', haptics: true, showProgress: true, speed: 'normal', sounds: true, cardTextScale: 1 };

let decks = [];
let cardsByDeck = new Map();
let selectedDeck = null;
let selectedCategory = 'Tất cả';
let settings = loadJSON(SETTINGS_KEY, defaultSettings);
let progress = null;
let drawBusy = false;
let navigationBusy = false;
let optionsReturnFocus = null;
let activeSound = null;
const soundPlayers = new Map();
settings.cardTextScale = Math.min(1.3, Math.max(.9, Number(settings.cardTextScale) || 1));
settings.sounds = settings.sounds !== false;

function loadJSON(key, fallback) {
  try { const saved = JSON.parse(localStorage.getItem(key)); return saved && typeof saved === 'object' ? { ...fallback, ...saved } : { ...fallback }; }
  catch { return { ...fallback }; }
}
function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing may disable storage. */ } }
function normalized(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
function playEffect(name) {
  if (!settings.sounds) return;
  let player = soundPlayers.get(name);
  if (!player) {
    player = new Audio(`./assets/sounds/${name}.wav`);
    player.preload = 'auto';
    soundPlayers.set(name, player);
  }
  if (activeSound && activeSound !== player) activeSound.pause();
  try { player.currentTime = 0; } catch { /* Audio metadata may not be ready yet. */ }
  activeSound = player;
  const playback = player.play();
  if (playback?.catch) playback.catch(() => {});
}
function pulseHaptic(duration = 12) {
  if (!settings.haptics || !navigator.vibrate) return;
  try { navigator.vibrate(duration); } catch { /* Vibration is unavailable in some browsers. */ }
}
function assetFor(deck, cover = false) {
  if (cover && deck.coverAsset) return `./assets/${/\.[a-z0-9]+$/i.test(deck.coverAsset) ? deck.coverAsset : `${deck.coverAsset}.png`}`;
  return deck.backgroundImagePath ? `./assets/${deck.backgroundImagePath.split('/').pop()}` : null;
}
function rgbaFromHex(hex, alpha = 1) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex ?? '');
  return match ? `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})` : `rgba(41,40,50,${alpha})`;
}
function applyDeckTheme(deck) {
  const play = $('#play');
  const background = deck.backgroundColor ?? '#171B22';
  const gradient = deck.gradientEndColor ?? '#36313F';
  const accent = deck.accentColor ?? '#D9BFA9';
  play.style.setProperty('--deck-background', background);
  play.style.setProperty('--deck-gradient-end', gradient);
  play.style.setProperty('--deck-text', deck.textColor ?? '#FFF8EF');
  play.style.setProperty('--deck-accent', accent);
  const zoneBackground = deck.zoneStyle?.backgroundColor ?? background;
  play.style.setProperty('--deck-card-surface', `linear-gradient(145deg,rgba(255,255,255,.04),transparent 42%,rgba(0,0,0,.05)),linear-gradient(rgba(0,0,0,.38),rgba(0,0,0,.38)),linear-gradient(${rgbaFromHex(zoneBackground, .22)},${rgbaFromHex(zoneBackground, .22)})`);
  play.style.setProperty('--deck-card-stroke', rgbaFromHex(accent, .45));
  play.style.setProperty('--deck-card-text-scale', String(settings.cardTextScale));
  const font = deck.mainFontName === 'Georgia' ? 'Georgia, serif' : 'Cormorant, Georgia, serif';
  play.style.setProperty('--deck-main-font', font);
  const image = assetFor(deck);
  play.style.setProperty('--deck-stack-surface', `linear-gradient(145deg,${rgbaFromHex(gradient, .88)},${rgbaFromHex(background, .96)})`);
  const overlay = Number.isFinite(deck.backgroundOverlayOpacity) ? deck.backgroundOverlayOpacity : .42;
  for (const element of document.querySelectorAll('.immersive-bg')) {
    const isGame = element.closest('.play-screen');
    const wash = rgbaFromHex(background, isGame ? Math.max(.52, overlay) : overlay);
    element.style.backgroundImage = image
      ? `linear-gradient(${wash},${wash}),url("${image}")`
      : `radial-gradient(ellipse at 50% 38%,${rgbaFromHex(accent, .26)},transparent 58%),linear-gradient(145deg,${background},${gradient})`;
    element.style.backgroundPosition = 'center 56%';
    element.style.backgroundSize = 'cover';
  }
}
function showError(message) { const toast = $('#error-toast'); toast.textContent = message; toast.hidden = false; setTimeout(() => toast.hidden = true, 5000); }
function showScreen(name) {
  for (const [id, screen] of Object.entries(screens)) { screen.hidden = id !== name; screen.classList.toggle('active', id === name); }
  window.scrollTo(0, 0);
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function loadDecks() {
  try {
    const indexResponse = await fetch('./data/deck-index.json');
    if (!indexResponse.ok) throw new Error('Không thể đọc danh sách bộ bài.');
    const index = await indexResponse.json();
    const valid = [];
    for (const deck of index.decks ?? []) {
      try {
        const cardResponse = await fetch(`./data/${encodeURIComponent(deck.cardFile)}`);
        if (!cardResponse.ok) throw new Error('Không thể đọc các lá bài.');
        const data = await cardResponse.json();
        const cards = data.cards;
        const ids = cards?.map(card => card.id) ?? [];
        if (!Array.isArray(cards) || cards.length !== deck.cardCount || new Set(ids).size !== cards.length || cards.some(card => !Array.isArray(card.zones) || card.zones.length !== deck.contentZoneCount || card.zones.some(zone => !zone.mainText))) throw new Error('Dữ liệu bộ bài chưa hợp lệ.');
        cardsByDeck.set(deck.id, cards);
        valid.push(deck);
      } catch (error) { console.error(`Bộ bài ${deck.id}:`, error); }
    }
    decks = valid;
    if (!decks.length) showError('Chưa thể tải bộ bài. Hãy thử tải lại trang.');
    renderFilters();
    renderDecks();
  } catch (error) { console.error(error); showError('Không thể tải thư viện. Hãy thử tải lại trang.'); }
}

function renderFilters() {
  const categories = [...BASE_CATEGORIES, ...decks.map(deck => deck.category).filter(category => !BASE_CATEGORIES.includes(category))];
  const list = $('#category-filters'); list.replaceChildren();
  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `filter-button${selectedCategory === category ? ' active' : ''}`;
    button.textContent = category; button.setAttribute('aria-pressed', selectedCategory === category);
    button.addEventListener('click', () => { selectedCategory = category; renderFilters(); renderDecks(); });
    list.append(button);
  }
}
function renderDecks() {
  const query = normalized($('#deck-search').value.trim());
  const matches = decks.filter(deck => (selectedCategory === 'Tất cả' || deck.category === selectedCategory) && normalized([deck.title, deck.subtitle, deck.category, ...(deck.tags ?? [])].join(' ')).includes(query));
  const grid = $('#deck-grid'); grid.replaceChildren();
  for (const deck of matches) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `deck-tile${deck.backgroundImagePath ? ' deck-tile-art' : ''}`;
    button.setAttribute('aria-label', `Mở bộ bài ${deck.title}, ${deck.cardCount} lá`);
    const image = document.createElement('span'); image.className = 'deck-tile-image';
    if (assetFor(deck, true)) image.style.backgroundImage = `url("${assetFor(deck, true)}")`;
    else image.style.backgroundImage = `linear-gradient(140deg,${deck.backgroundColor ?? '#292832'},${deck.gradientEndColor ?? '#39313B'})`;
    const shade = document.createElement('span'); shade.className = 'deck-tile-shade';
    if (deck.backgroundImagePath) {
      const tileBase = deck.backgroundColor ?? '#171B22';
      shade.style.backgroundImage = `linear-gradient(90deg,${rgbaFromHex(tileBase, .98)} 0%,${rgbaFromHex(tileBase, .98)} 39%,${rgbaFromHex(tileBase, .78)} 53%,${rgbaFromHex(tileBase, .06)} 73%,transparent 100%)`;
    }
    const content = document.createElement('span'); content.className = 'deck-tile-content';
    const category = document.createElement('span'); category.className = 'tile-category'; category.textContent = `✦   ${deck.category.toUpperCase()}`;
    const title = document.createElement('span'); title.className = 'tile-title'; title.textContent = deck.title;
    const subtitle = document.createElement('span'); subtitle.className = 'tile-subtitle'; subtitle.textContent = deck.subtitle;
    const footer = document.createElement('span'); footer.className = 'tile-footer'; footer.innerHTML = `<span>${deck.cardCount} LÁ BÀI</span><span class="tile-rule"></span><span class="tile-arrow" aria-hidden="true">↗</span>`;
    content.append(category, title, subtitle, footer); button.append(image, shade, content);
    button.addEventListener('click', () => openDeck(deck, button)); grid.append(button);
  }
  $('#empty-state').hidden = matches.length > 0;
}

async function enterLibrary() {
  if (navigationBusy) return;
  navigationBusy = true;
  playEffect('library_whoosh'); pulseHaptic(10);
  screens.intro.classList.add('leaving');
  await delay(reducedMotion.matches ? 180 : 1750);
  showScreen('library'); navigationBusy = false;
}
async function openDeck(deck, source) {
  if (navigationBusy) return;
  navigationBusy = true; selectedDeck = deck; progress = loadProgress(deck.id);
  playEffect('card_slide'); pulseHaptic(10);
  const image = assetFor(deck);
  applyDeckTheme(deck);
  $('.guide-title').textContent = deck.title;
  $('.guide-title').classList.toggle('sr-only', Boolean(image));
  $('.guide-description').textContent = deck.introMessage ?? 'Nhấn vào màn hình, lá bài với nội dung bất kì sẽ xuất hiện, việc của bạn là hãy tận hưởng câu hỏi đấy.';
  $('#play-deck-title').textContent = deck.title;
  $('#play-deck-title').classList.remove('sr-only');
  $('#play').setAttribute('aria-label', `Chơi bộ bài ${deck.title}`);
  $('#confirm-text').textContent = `Các lá đã rút và lá đang hiển thị của bộ ${deck.title} sẽ được xóa.`;
  const rect = source.getBoundingClientRect();
  const overlay = document.createElement('div'); overlay.className = 'deck-opening-overlay';
  overlay.style.left = `${rect.left}px`; overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`; overlay.style.height = `${rect.height}px`;
  const overlayOpacity = Number.isFinite(deck.backgroundOverlayOpacity) ? deck.backgroundOverlayOpacity : .42;
  const openingWash = rgbaFromHex(deck.backgroundColor ?? '#171B22', Math.min(.72, overlayOpacity + .12));
  overlay.style.backgroundImage = image
    ? `linear-gradient(${openingWash},${openingWash}),url("${image}")`
    : `linear-gradient(140deg,${deck.backgroundColor ?? '#292832'},${deck.gradientEndColor ?? '#39313B'})`;
  overlay.textContent = image ? '' : deck.title;
  document.body.append(overlay);
  showScreen('guide');
  if (!reducedMotion.matches) {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    overlay.classList.add('is-opening');
  }
  await delay(reducedMotion.matches ? 150 : 1350);
  overlay.remove();
  navigationBusy = false;
}
async function startPlay() {
  if (navigationBusy) return;
  navigationBusy = true;
  screens.guide.classList.add('opening');
  await delay(reducedMotion.matches ? 100 : 1350);
  screens.guide.classList.remove('opening');
  showScreen('play');
  const currentCard = cardsByDeck.get(selectedDeck.id)?.find(card => card.id === progress.currentCardId);
  if (currentCard) renderCard(currentCard, false); else renderCardBack();
  applyCardTextScale(); updateProgress(); navigationBusy = false;
}
function loadProgress(deckId) {
  const saved = loadJSON(PROGRESS_PREFIX + deckId, { seen: [], drawCount: 0, round: 1 });
  const validIds = new Set((cardsByDeck.get(deckId) ?? []).map(card => card.id));
  const seen = Array.isArray(saved.seen) ? [...new Set(saved.seen.filter(id => validIds.has(id)))] : [];
  return {
    seen,
    currentCardId: validIds.has(saved.currentCardId) ? saved.currentCardId : null,
    drawCount: Number.isFinite(saved.drawCount) ? saved.drawCount : Number.isFinite(saved.completedDraws) ? saved.completedDraws : 0,
    completedDraws: Number.isFinite(saved.completedDraws) ? saved.completedDraws : Number.isFinite(saved.drawCount) ? saved.drawCount : 0,
    round: Number.isFinite(saved.round) ? saved.round : 1
  };
}
function saveProgress() {
  if (selectedDeck) saveJSON(PROGRESS_PREFIX + selectedDeck.id, { ...progress, completedDraws: progress.drawCount });
}
function updateProgress() {
  if (!selectedDeck) return;
  const total = selectedDeck.cardCount;
  const count = progress.seen.length;
  $('#progress-wrap').hidden = !settings.showProgress;
  $('#progress-label').textContent = `ĐÃ RÚT ${count}/${total} · CÒN ${Math.max(0, total - count)}`;
  $('#progress-bar').style.width = `${Math.min(100, count / total * 100)}%`;
  const ended = settings.mode === 'stop' && progress.seen.length >= total;
  $('#end-actions p').textContent = selectedDeck.contentZoneCount === 2
    ? `Đã đi qua tất cả ${total} cặp Thật/Thách. Bạn có thể bắt đầu lượt mới.`
    : `Đã đi qua tất cả ${total} câu hỏi. Một cuộc trò chuyện đẹp vẫn có thể bắt đầu lại.`;
  $('#end-actions').hidden = !ended;
  $('#draw-card').disabled = ended;
  $('#play-hint').hidden = ended;
  $('#play-hint').textContent = drawBusy
    ? 'ĐANG XÀO BÀI...'
    : !progress.currentCardId
      ? 'CHẠM VÀO LÁ BÀI ĐỂ BẮT ĐẦU ↑'
      : selectedDeck.contentZoneCount === 2
      ? 'NGƯỜI RÚT TỰ CHỌN THẬT HOẶC THÁCH · CHẠM ĐỂ RÚT TIẾP ↑'
      : 'CHẠM VÀO LÁ BÀI ĐỂ RÚT TIẾP ↑';
}
function renderCardBack() {
  const card = $('#draw-card'); card.className = 'draw-card card-back';
  card.setAttribute('aria-label', 'Rút một lá bài');
  $('#card-inner').innerHTML = '<span class="card-back-content"><span class="card-corner">✦</span><span class="card-back-title">Trải<br /><em>Lòng</em></span><span class="card-back-rule"></span><span class="card-back-caption">MỘT CÂU HỎI CHO HAI NGƯỜI</span><span class="card-corner card-corner-bottom">✦</span></span>';
  const words = selectedDeck.title.split(' ');
  const title = $('.card-back-title'); title.replaceChildren(document.createTextNode(words.shift() ?? ''));
  if (words.length) { const line = document.createElement('em'); line.textContent = words.join(' '); title.append(document.createElement('br'), line); }
  $('.card-back-caption').textContent = selectedDeck.contentZoneCount === 2 ? 'THẬT HAY THÁCH · NGƯỜI RÚT' : 'MỘT CÂU HỎI CHO HAI NGƯỜI';
  $('#live-announcement').textContent = '';
}
function renderCard(cardData, announce = true) {
  const inner = $('#card-inner'); inner.replaceChildren();
  const content = document.createElement('span'); content.className = 'card-front-content';
  const top = document.createElement('span'); top.className = 'card-front-top'; top.textContent = `✦  ${selectedDeck.title.toUpperCase()}  ✦`;
  const multiZone = cardData.zones.length > 1;
  const zones = document.createElement('span'); zones.className = `card-front-zones${multiZone ? ' two-zone' : ''}`;
  for (const zoneData of cardData.zones) {
    const zone = document.createElement('span'); zone.className = `card-zone${multiZone ? ' two-zone' : ''}`;
    if (zoneData.label) { const label = document.createElement('span'); label.className = 'card-zone-label'; label.textContent = zoneData.label; zone.append(label); }
    const main = document.createElement('span'); main.className = 'card-main-text'; main.textContent = zoneData.mainText;
    zone.append(main);
    if (zoneData.note) { const note = document.createElement('span'); note.className = 'card-note'; note.textContent = zoneData.note; zone.append(note); }
    zones.append(zone);
  }
  const bottom = document.createElement('span'); bottom.className = 'card-front-bottom'; bottom.textContent = cardData.id.split('-').pop().padStart(2, '0');
  content.append(top, zones, bottom); inner.append(content);
  $('#draw-card').classList.remove('card-back'); $('#draw-card').setAttribute('aria-label', `Lá bài: ${cardData.zones.map(z => `${z.label ? `${z.label}: ` : ''}${z.mainText}`).join('. ')}. Chạm để rút lá tiếp theo.`);
  if (announce) announceCard(cardData);
}
function announceCard(cardData) {
  $('#live-announcement').textContent = cardData.zones.map(z => `${z.label ? `${z.label}: ` : ''}${z.mainText} ${z.note ?? ''}`).join(' ');
}
async function playCardAnimation(element, frames, duration, easing) {
  if (!element.animate) { await delay(duration); return null; }
  const animation = element.animate(frames, { duration, easing, fill: 'forwards' });
  try { await animation.finished; } catch { /* Finish the draw if animation is interrupted. */ }
  return animation;
}
function shufflePreviewSequence(available, chosen) {
  const previews = available.filter(card => card.id !== chosen.id).slice();
  for (let i = previews.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [previews[i], previews[j]] = [previews[j], previews[i]];
  }
  return [...previews.slice(0, 4), chosen];
}
async function exchangeCard(card, nextCard, duration, direction, reduced) {
  const outTime = Math.round(duration * .42);
  const inTime = duration - outTime;
  const outgoing = reduced
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
        { transform: 'translate3d(0,0,18px) rotateY(0deg) rotateZ(0deg) scale(1)', opacity: 1, offset: 0 },
        { transform: `translate3d(${direction * 14}%, -3%, 6px) rotateY(${-direction * 13}deg) rotateZ(${direction * 5}deg) scale(.98)`, opacity: .92, offset: .38 },
        { transform: `translate3d(${direction * 92}%, -5%, -90px) rotateY(${-direction * 42}deg) rotateZ(${direction * 13}deg) scale(.9)`, opacity: 0, offset: 1 }
      ];
  let animation = await playCardAnimation(card, outgoing, outTime, reduced ? 'ease-out' : 'cubic-bezier(.3,.05,.75,.45)');
  card.style.opacity = '0';
  animation?.cancel();
  renderCard(nextCard, false);
  const incoming = reduced
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [
        { transform: `translate3d(${-direction * 82}%, 5%, -80px) rotateY(${direction * 40}deg) rotateZ(${-direction * 12}deg) scale(.92)`, opacity: 0, offset: 0 },
        { transform: `translate3d(${-direction * 17}%, -2%, 3px) rotateY(${direction * 8}deg) rotateZ(${-direction * 4}deg) scale(.98)`, opacity: 1, offset: .62 },
        { transform: 'translate3d(0,0,18px) rotateY(0deg) rotateZ(0deg) scale(1)', opacity: 1, offset: 1 }
      ];
  animation = await playCardAnimation(card, incoming, inTime, reduced ? 'ease-in' : 'cubic-bezier(.12,.7,.2,1)');
  card.style.opacity = '1';
  animation?.cancel();
  card.style.opacity = '';
}
async function drawCard() {
  if (drawBusy || !selectedDeck || (settings.mode === 'stop' && progress.seen.length >= selectedDeck.cardCount)) return;
  drawBusy = true;
  const cards = cardsByDeck.get(selectedDeck.id);
  let available = settings.mode === 'repeat' ? cards : cards.filter(card => !progress.seen.includes(card.id));
  if (!available.length && settings.mode === 'reshuffle') { progress.seen = []; progress.round += 1; available = cards; }
  if (!available.length) { drawBusy = false; updateProgress(); return; }
  const chosen = available[Math.floor(Math.random() * available.length)];
  const sequence = shufflePreviewSequence(available, chosen);
  playEffect(reducedMotion.matches ? 'card_slide' : `card_shuffle_${settings.speed}`);
  pulseHaptic(12);
  const card = $('#draw-card'); const area = $('.card-area');
  const duration = reducedMotion.matches ? 160 : settings.speed === 'fast' ? 850 : 1350;
  const hapticBeatDuration = settings.speed === 'fast' ? 170 : 190;
  const hapticTimer = !reducedMotion.matches && settings.haptics && navigator.vibrate
    ? setInterval(() => pulseHaptic(8), hapticBeatDuration)
    : null;
  $('#live-announcement').textContent = '';
  card.setAttribute('aria-busy', 'true');
  card.classList.add('drawing'); area.classList.add('drawing');
  updateProgress();
  const backCards = reducedMotion.matches || !Element.prototype.animate ? [] : [
    $('.stack-card-2').animate([
      { transform: 'rotate(-5deg) translate(-7px,2px)', offset: 0 },
      { transform: 'rotateY(-17deg) rotate(-15deg) translate(-27px,-12px)', offset: .24 },
      { transform: 'rotateY(12deg) rotate(9deg) translate(24px,-5px)', offset: .58 },
      { transform: 'rotateY(-4deg) rotate(-5deg) translate(-7px,2px)', offset: .82 },
      { transform: 'rotate(-5deg) translate(-7px,2px)', offset: 1 }
    ], { duration, easing: 'ease-in-out' }),
    $('.stack-card-3').animate([
      { transform: 'rotate(7deg) translate(7px,6px)', offset: 0 },
      { transform: 'rotateY(19deg) rotate(17deg) translate(31px,-11px)', offset: .32 },
      { transform: 'rotateY(-13deg) rotate(-8deg) translate(-14px,3px)', offset: .65 },
      { transform: 'rotateY(5deg) rotate(8deg) translate(10px,0)', offset: .84 },
      { transform: 'rotate(7deg) translate(7px,6px)', offset: 1 }
    ], { duration, easing: 'ease-in-out' })
  ];
  const weightTotal = sequence.reduce((sum, _item, index) => sum + index + 1, 0);
  for (let index = 0; index < sequence.length; index += 1) {
    const stepDuration = Math.round(duration * (index + 1) / weightTotal);
    await exchangeCard(card, sequence[index], stepDuration, index % 2 === 0 ? 1 : -1, reducedMotion.matches);
  }
  card.removeAttribute('aria-busy');
  card.classList.remove('drawing'); area.classList.remove('drawing');
  if (hapticTimer) clearInterval(hapticTimer);
  backCards.forEach(animation => animation.cancel());
  announceCard(chosen);
  progress.currentCardId = chosen.id;
  progress.drawCount += 1;
  progress.completedDraws = progress.drawCount;
  if (!progress.seen.includes(chosen.id)) progress.seen.push(chosen.id);
  drawBusy = false; saveProgress(); updateProgress();
}

function openOptions() {
  optionsReturnFocus = document.activeElement;
  $('#options-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector(`input[name="draw-mode"][value="${settings.mode}"]`).checked = true;
  document.querySelector(`input[name="draw-speed"][value="${settings.speed}"]`).checked = true;
  $('#sounds-toggle').checked = settings.sounds;
  $('#haptics-toggle').checked = settings.haptics;
  $('#progress-toggle').checked = settings.showProgress;
  applyCardTextScale();
  $('#options-close').focus();
}
function closeOptions() { $('#options-overlay').hidden = true; document.body.style.overflow = ''; optionsReturnFocus?.focus(); }
function applyCardTextScale() {
  if (!selectedDeck) return;
  const scale = Math.min(1.3, Math.max(.9, Number(settings.cardTextScale) || 1));
  settings.cardTextScale = scale;
  $('#play').style.setProperty('--deck-card-text-scale', String(scale));
  $('#card-scale-label').textContent = `${Math.round(scale * 100)}%`;
  $('#scale-down').disabled = scale <= .9;
  $('#scale-up').disabled = scale >= 1.3;
  $('#font-preview').style.fontFamily = selectedDeck.mainFontName === 'Georgia' ? 'Georgia, serif' : 'Cormorant, Georgia, serif';
  $('#font-preview').style.fontSize = `${(selectedDeck.contentZoneCount === 2 ? 21 : 30) * scale}px`;
}
function updateSettings(patch) {
  settings = { ...settings, ...patch };
  settings.cardTextScale = Math.min(1.3, Math.max(.9, Number(settings.cardTextScale) || 1));
  saveJSON(SETTINGS_KEY, settings);
  applyCardTextScale(); updateProgress();
}
function changeCardTextScale(amount) { updateSettings({ cardTextScale: Math.round((settings.cardTextScale + amount) * 100) / 100 }); }
function openConfirmation() { $('#confirm-overlay').hidden = false; $('#confirm-cancel').focus(); }
function closeConfirmation() { $('#confirm-overlay').hidden = true; $('#reset-button').focus(); }
function resetProgress() { progress = { seen: [], currentCardId: null, drawCount: 0, completedDraws: 0, round: 1 }; saveProgress(); renderCardBack(); updateProgress(); $('#live-announcement').textContent = 'Bộ bài đã được xáo lại từ đầu.'; }

$('#intro-enter').addEventListener('click', enterLibrary);
$('#deck-search').addEventListener('input', renderDecks);
$('#guide-back').addEventListener('click', () => showScreen('library'));
$('#guide-start').addEventListener('click', startPlay);
$('#play-back').addEventListener('click', () => { if (!drawBusy) showScreen('library'); });
$('#draw-card').addEventListener('click', drawCard);
$('#replay-button').addEventListener('click', resetProgress);
$('#options-open').addEventListener('click', openOptions);
$('#options-close').addEventListener('click', closeOptions);
$('[data-close-options]').addEventListener('click', closeOptions);
document.querySelectorAll('input[name="draw-mode"]').forEach(input => input.addEventListener('change', () => updateSettings({ mode: input.value })));
document.querySelectorAll('input[name="draw-speed"]').forEach(input => input.addEventListener('change', () => updateSettings({ speed: input.value })));
$('#haptics-toggle').addEventListener('change', event => updateSettings({ haptics: event.target.checked }));
$('#sounds-toggle').addEventListener('change', event => updateSettings({ sounds: event.target.checked }));
$('#progress-toggle').addEventListener('change', event => updateSettings({ showProgress: event.target.checked }));
$('#scale-down').addEventListener('click', () => changeCardTextScale(-.05));
$('#scale-up').addEventListener('click', () => changeCardTextScale(.05));
$('#reset-button').addEventListener('click', openConfirmation);
$('#confirm-cancel').addEventListener('click', closeConfirmation);
$('#confirm-reset').addEventListener('click', () => { resetProgress(); closeConfirmation(); closeOptions(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (!$('#confirm-overlay').hidden) closeConfirmation(); else if (!$('#options-overlay').hidden) closeOptions(); } });

loadDecks();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
