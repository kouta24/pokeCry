// ポケモンの鳴き声とドット絵データを取得（カントー地方限定）
async function fetchPokemonCry(pokemonId) {
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        if (!response.ok) throw new Error(`ポケモンID ${pokemonId} のデータ取得に失敗しました`);
        const data = await response.json();
        const cryUrl = data.cries.legacy || data.cries.latest || 'https://example.com/default-cry.mp3'; // デフォルト音声
        console.log(`ポケモン: ${data.name}, 鳴き声: ${cryUrl}`);
        return {
            name: data.name,
            cry: cryUrl,
            sprite: data.sprites.versions['generation-v']['black-white'].front_default
        };
    } catch (error) {
        console.error('エラー:', error);
        return null;
    }
}

// 重複しないポケモンIDを生成
function getUniquePokemonIds(count) {
    const ids = [];
    const availableIds = Array.from({ length: 151 }, (_, i) => i + 1);
    for (let i = 0; i < count && availableIds.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableIds.length);
        ids.push(availableIds.splice(randomIndex, 1)[0]);
    }
    return ids;
}

// 指定した数のポケモンデータを取得（レート制限対策で遅延を追加）
async function getPokemonCries(count) {
    const pokemonIds = getUniquePokemonIds(count);
    const pokemonData = [];
    for (const id of pokemonIds) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms遅延
        const data = await fetchPokemonCry(id);
        if (data) pokemonData.push(data);
    }
    return [...pokemonData, ...pokemonData];
}

// ゲームボードを構築
function createGameBoard(pokemonList, rows, cols) {
    const gameBoard = document.getElementById('game-board');
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const shuffled = pokemonList.sort(() => Math.random() - 0.5);
    shuffled.forEach((pokemon, index) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.pokemon = pokemon.name;
        card.dataset.index = index;
        card.dataset.sprite = pokemon.sprite;
        card.addEventListener('click', () => {
            console.log(`カードクリック: ${pokemon.name}`);
            handleCardClick(card, pokemon.cry, pokemon.sprite);
        }, { once: false });
        gameBoard.appendChild(card);
    });
}

// ゲーム状態の管理
let flippedCards = [];
let matchedPairs = 0;
let mistakes = 0;
let isProcessing = false;
let volume = 0.05;
let timerInterval = null;
let elapsedTime = 0;
let totalPairs = 0;
let selectedDifficulty = '';
let startTime = 0;

// タイマー管理（高精度）
function startTimer() {
    if (timerInterval) cancelAnimationFrame(timerInterval);
    startTime = performance.now();
    function updateTimer() {
        elapsedTime = Math.floor((performance.now() - startTime) / 1000);
        document.getElementById('timer').textContent = elapsedTime;
        console.log(`タイマー更新: ${elapsedTime}秒`);
        timerInterval = requestAnimationFrame(updateTimer);
    }
    timerInterval = requestAnimationFrame(updateTimer);
}

function stopTimer() {
    if (timerInterval) cancelAnimationFrame(timerInterval);
    timerInterval = null;
}

// 音量スライダーの初期化
function setupVolumeControl() {
    const volumeSlider = document.getElementById('volume');
    const volumeValue = document.getElementById('volume-value');
    volumeSlider.addEventListener('input', () => {
        volume = volumeSlider.value / 100;
        volumeValue.textContent = `${volumeSlider.value}%`;
    });
}

// カードクリック時の処理
function handleCardClick(card, cryUrl, spriteUrl) {
    if (isProcessing || flippedCards.length >= 2 || card.classList.contains('flipped') || card.classList.contains('matched')) {
        console.log('クリック無効:', { isProcessing, flippedCardsLength: flippedCards.length, isFlipped: card.classList.contains('flipped'), isMatched: card.classList.contains('matched') });
        return;
    }

    card.classList.add('flipped');
    if (cryUrl) {
        const audio = new Audio(cryUrl);
        audio.volume = volume;
        audio.play().catch(error => {
            console.error(`音声再生エラー (${card.dataset.pokemon}):`, error);
            alert(`鳴き声の再生に失敗しました: ${card.dataset.pokemon}`);
        });
    } else {
        console.warn(`鳴き声URLがありません: ${card.dataset.pokemon}`);
        alert(`鳴き声がありません: ${card.dataset.pokemon}`);
    }
    flippedCards.push({ card, cryUrl, spriteUrl });

    if (flippedCards.length === 2) {
        isProcessing = true;
        const [card1, card2] = flippedCards;
        if (card1.cryUrl === card2.cryUrl) {
            card1.card.classList.add('matched');
            card2.card.classList.add('matched');
            card1.card.style.backgroundImage = `url(${card1.spriteUrl})`;
            card2.card.style.backgroundImage = `url(${card2.spriteUrl})`;
            matchedPairs += 1;
            flippedCards = [];
            isProcessing = false;
            if (matchedPairs === totalPairs) {
                stopTimer();
                setTimeout(() => alert(`${selectedDifficulty}クリア！\nクリア時間: ${elapsedTime}秒, 間違えた回数: ${mistakes}回`), 500);
            }
        } else {
            mistakes += 1;
            document.getElementById('mistakes').textContent = mistakes;
            setTimeout(() => {
                card1.card.classList.remove('flipped');
                card2.card.classList.remove('flipped');
                flippedCards = [];
                isProcessing = false;
            }, 1000);
        }
    }
}

// ゲーム開始
async function startGame(rows, cols, pairs, difficulty) {
    selectedDifficulty = difficulty;
    totalPairs = pairs;
    flippedCards = [];
    matchedPairs = 0;
    mistakes = 0;
    isProcessing = false;
    elapsedTime = 0;
    document.getElementById('mistakes').textContent = mistakes;
    document.getElementById('timer').textContent = elapsedTime;
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('game-board').innerHTML = '';
    document.getElementById('difficulty-selection').style.display = 'block';
    const pokemonList = await getPokemonCries(pairs);
    if (pokemonList.length === 0) {
        alert('ポケモンデータの取得に失敗しました。もう一度お試しください。');
        return;
    }
    document.getElementById('difficulty-selection').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    createGameBoard(pokemonList, rows, cols);
    startTimer();
}

// 難易度選択とリスタート
function setupControls() {
    document.getElementById('easy').addEventListener('click', () => startGame(3, 4, 6, '初級'));
    document.getElementById('medium').addEventListener('click', () => startGame(4, 5, 10, '中級'));
    document.getElementById('hard').addEventListener('click', () => startGame(5, 6, 15, '上級'));
    document.getElementById('restart').addEventListener('click', () => {
        console.log('リスタートボタンクリック');
        if (confirm('リスタートしますか？')) {
            stopTimer();
            document.getElementById('game-container').style.display = 'none';
            document.getElementById('game-board').innerHTML = '';
            document.getElementById('difficulty-selection').style.display = 'block';
        }
    });
}

// 初期化
setupVolumeControl();
setupControls();
