const ROWS = 6;
const COLS = 7;
const EMPTY = 0, P1 = 1, P2 = 2; // P1: Green, P2: Purple
let board = [];
let currentPlayer = P1;
let myPlayer = P1;
let gameMode = ''; 
let peer = null, conn = null;
let gameOver = false;

const menuUI = document.getElementById('menu-ui');
const gameUI = document.getElementById('game-ui');
const resultScreen = document.getElementById('result-screen');
const boardEl = document.getElementById('board');
const turnDisplay = document.getElementById('turn-display');
const resultTitle = document.getElementById('result-title');
const resultMsg = document.getElementById('result-message');

function createBoard() {
    board = Array(ROWS).fill().map(() => Array(COLS).fill(EMPTY));
    gameOver = false;
    currentPlayer = P1;
    renderBoard();
    updateStatus();
}

function renderBoard(winningCells = []) {
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let cell = document.createElement('div');
            cell.className = 'cell';
            cell.onclick = () => handleColumnClick(c);
            
            if (board[r][c] !== EMPTY) {
                let core = document.createElement('div');
                core.className = `core p${board[r][c]}`;
                if (winningCells.some(w => w.r === r && w.c === c)) {
                    core.classList.add('win');
                }
                cell.appendChild(core);
            }
            boardEl.appendChild(cell);
        }
    }
}

function updateStatus() {
    if (gameOver) return;
    const color = currentPlayer === P1 ? 'var(--p1)' : 'var(--p2)';
    turnDisplay.style.color = color;
    
    if (gameMode === 'ai' && currentPlayer !== myPlayer) {
        turnDisplay.innerText = "AI Computing...";
    } else if (currentPlayer === myPlayer) {
        turnDisplay.innerText = "Your Turn";
    } else {
        turnDisplay.innerText = "Opponent's Turn";
    }
}

function getAvailableRow(b, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (b[r][col] === EMPTY) return r;
    }
    return -1;
}

function handleColumnClick(c) {
    if (gameOver || currentPlayer !== myPlayer) return;
    let r = getAvailableRow(board, c);
    if (r === -1) return; // Column full
    executeMove(r, c);
}

function executeMove(r, c) {
    board[r][c] = currentPlayer;
    
    if (gameMode === 'p2p' && currentPlayer === myPlayer) {
        conn.send({ type: 'move', c: c });
    }

    let winState = checkWin(board, currentPlayer);
    
    if (winState) {
        gameOver = true;
        renderBoard(winState.cells);
        setTimeout(() => showResult(currentPlayer), 1000);
        return;
    } 
    
    if (checkDraw(board)) {
        gameOver = true;
        renderBoard();
        setTimeout(() => showResult(EMPTY), 1000);
        return;
    }

    currentPlayer = currentPlayer === P1 ? P2 : P1;
    renderBoard();
    updateStatus();

    if (gameMode === 'ai' && currentPlayer !== myPlayer && !gameOver) {
        setTimeout(playAI, 100); // Slight delay for UI update
    }
}

// --- WIN LOGIC ---
function checkWin(b, player) {
    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (b[r][c] === player && b[r][c+1] === player && b[r][c+2] === player && b[r][c+3] === player)
                return { cells: [{r,c}, {r,c:c+1}, {r,c:c+2}, {r,c:c+3}] };
        }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            if (b[r][c] === player && b[r+1][c] === player && b[r+2][c] === player && b[r+3][c] === player)
                return { cells: [{r,c}, {r:r+1,c}, {r:r+2,c}, {r:r+3,c}] };
        }
    }
    // Diagonal (Positive slope)
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (b[r][c] === player && b[r+1][c+1] === player && b[r+2][c+2] === player && b[r+3][c+3] === player)
                return { cells: [{r,c}, {r:r+1,c:c+1}, {r:r+2,c:c+2}, {r:r+3,c:c+3}] };
        }
    }
    // Diagonal (Negative slope)
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (b[r][c] === player && b[r-1][c+1] === player && b[r-2][c+2] === player && b[r-3][c+3] === player)
                return { cells: [{r,c}, {r:r-1,c:c+1}, {r:r-2,c:c+2}, {r:r-3,c:c+3}] };
        }
    }
    return null;
}

function checkDraw(b) {
    for (let c = 0; c < COLS; c++) {
        if (b[0][c] === EMPTY) return false;
    }
    return true;
}

// --- HARD AI (Minimax + Alpha Beta) ---
const AI_PLAYER = P2;
const HUMAN = P1;

function evaluateWindow(window, piece) {
    let score = 0;
    const oppPiece = piece === P1 ? P2 : P1;
    let countPiece = window.filter(c => c === piece).length;
    let countEmpty = window.filter(c => c === EMPTY).length;
    let countOpp = window.filter(c => c === oppPiece).length;

    if (countPiece === 4) score += 100;
    else if (countPiece === 3 && countEmpty === 1) score += 5;
    else if (countPiece === 2 && countEmpty === 2) score += 2;

    if (countOpp === 3 && countEmpty === 1) score -= 80; // Block heavily

    return score;
}

function scorePosition(b, piece) {
    let score = 0;
    
    // Favor center column
    let centerArray = [];
    for(let r=0; r<ROWS; r++) centerArray.push(b[r][Math.floor(COLS/2)]);
    let centerCount = centerArray.filter(c => c === piece).length;
    score += centerCount * 3;

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [b[r][c], b[r][c+1], b[r][c+2], b[r][c+3]];
            score += evaluateWindow(window, piece);
        }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            let window = [b[r][c], b[r+1][c], b[r+2][c], b[r+3][c]];
            score += evaluateWindow(window, piece);
        }
    }
    // Diagonals... (simplified scoring logic for speed in JS)
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let w1 = [b[r][c], b[r+1][c+1], b[r+2][c+2], b[r+3][c+3]];
            score += evaluateWindow(w1, piece);
        }
    }
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let w2 = [b[r][c], b[r-1][c+1], b[r-2][c+2], b[r-3][c+3]];
            score += evaluateWindow(w2, piece);
        }
    }
    return score;
}

function getValidLocations(b) {
    let validLocations = [];
    for (let c = 0; c < COLS; c++) {
        if (b[0][c] === EMPTY) validLocations.push(c);
    }
    return validLocations;
}

function isTerminalNode(b) {
    return checkWin(b, P1) || checkWin(b, P2) || getValidLocations(b).length === 0;
}

function minimax(b, depth, alpha, beta, maximizingPlayer) {
    let validLocations = getValidLocations(b);
    let isTerminal = isTerminalNode(b);
    if (depth === 0 || isTerminal) {
        if (isTerminal) {
            if (checkWin(b, AI_PLAYER)) return [null, 1000000];
            else if (checkWin(b, HUMAN)) return [null, -1000000];
            else return [null, 0];
        } else {
            return [null, scorePosition(b, AI_PLAYER)];
        }
    }

    if (maximizingPlayer) {
        let value = -Infinity;
        let bestCol = validLocations[Math.floor(Math.random() * validLocations.length)];
        for (let col of validLocations) {
            let row = getAvailableRow(b, col);
            let bCopy = b.map(arr => [...arr]);
            bCopy[row][col] = AI_PLAYER;
            let newScore = minimax(bCopy, depth - 1, alpha, beta, false)[1];
            if (newScore > value) {
                value = newScore;
                bestCol = col;
            }
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return [bestCol, value];
    } else {
        let value = Infinity;
        let bestCol = validLocations[Math.floor(Math.random() * validLocations.length)];
        for (let col of validLocations) {
            let row = getAvailableRow(b, col);
            let bCopy = b.map(arr => [...arr]);
            bCopy[row][col] = HUMAN;
            let newScore = minimax(bCopy, depth - 1, alpha, beta, true)[1];
            if (newScore < value) {
                value = newScore;
                bestCol = col;
            }
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return [bestCol, value];
    }
}

function playAI() {
    turnDisplay.innerText = "AI is thinking...";
    setTimeout(() => {
        let [col, score] = minimax(board, 5, -Infinity, Infinity, true); // Depth 5
        let r = getAvailableRow(board, col);
        if (r !== -1) executeMove(r, col);
    }, 50); // allow UI to render the "thinking" text
}

// --- GAME FLOW & NETWORKING ---
function showResult(winner) {
    gameUI.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    
    if (winner === EMPTY) {
        resultTitle.innerText = "DRAW!";
        resultTitle.style.color = "white";
        resultMsg.innerText = "The grid is locked.";
    } else if (winner === myPlayer) {
        resultTitle.innerText = "YOU WIN!";
        resultTitle.style.color = winner === P1 ? "var(--p1)" : "var(--p2)";
        resultMsg.innerText = gameMode === 'ai' ? "You beat the Hard AI!" : "You defeated your opponent!";
    } else {
        resultTitle.innerText = "YOU LOSE!";
        resultTitle.style.color = winner === P1 ? "var(--p1)" : "var(--p2)";
        resultMsg.innerText = gameMode === 'ai' ? "The AI outsmarted you." : "Your opponent won.";
    }
}

function resetToMenu() {
    resultScreen.classList.add('hidden');
    menuUI.classList.remove('hidden');
    if (conn) { conn.close(); conn = null; }
    if (peer) { peer.destroy(); peer = null; }
}

function startAIGame() {
    gameMode = 'ai'; myPlayer = P1;
    menuUI.classList.add('hidden');
    gameUI.classList.remove('hidden');
    createBoard();
}

function initPeer(isHost) {
    peer = new Peer();
    peer.on('open', id => { 
        if(isHost) document.getElementById('peer-id-display').innerText = id; 
    });
    peer.on('connection', connection => {
        conn = connection; setupConn();
        myPlayer = P1; startGameP2P();
    });
}

function hostGame() {
    document.getElementById('host-info').classList.remove('hidden');
    initPeer(true);
}

function joinGame() {
    const hostId = document.getElementById('join-id').value;
    if (!hostId) return alert('Enter Host Code');
    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(hostId);
        conn.on('open', () => {
            myPlayer = P2; setupConn(); startGameP2P();
        });
    });
}

function setupConn() {
    conn.on('data', data => {
        if (data.type === 'move') {
            let r = getAvailableRow(board, data.c);
            executeMove(r, data.c);
        }
    });
    conn.on('close', () => { alert("Opponent left the match."); resetToMenu(); });
}

function startGameP2P() {
    gameMode = 'p2p';
    menuUI.classList.add('hidden');
    gameUI.classList.remove('hidden');
    createBoard();
}
