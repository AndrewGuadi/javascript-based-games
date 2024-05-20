document.addEventListener('DOMContentLoaded', function () {
    const columns = 7;
    const rows = 6;
    let board = Array(rows).fill().map(() => Array(columns).fill(0));
    const gameBoard = document.getElementById('gameBoard');
    const playerColor = 'red';
    const aiColor = 'yellow';
    let currentPlayer = 'player'; // 'player' or 'ai'
    const resetButton = document.getElementById('resetGame');
    const loadingText = document.getElementById('loadingText');

    function createBoard() {
        gameBoard.innerHTML = '';
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.column = col;
                cell.dataset.row = row;
                gameBoard.appendChild(cell);
                cell.addEventListener('click', () => {
                    if (currentPlayer === 'player') {
                        makeMove(col, true);
                    }
                });
            }
        }
    }

    function checkWin() {
        // Check all possible lines where connect four could occur
        // Check horizontal, vertical, and diagonal lines
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < columns - 3; col++) {
                if (board[row][col] !== 0 &&
                    board[row][col] === board[row][col + 1] &&
                    board[row][col + 1] === board[row][col + 2] &&
                    board[row][col + 2] === board[row][col + 3]) {
                    return true;
                }
            }
        }

        for (let col = 0; col < columns; col++) {
            for (let row = 0; row < rows - 3; row++) {
                if (board[row][col] !== 0 &&
                    board[row][col] === board[row + 1][col] &&
                    board[row + 1][col] === board[row + 2][col] &&
                    board[row + 2][col] === board[row + 3][col]) {
                    return true;
                }
            }
        }

        for (let row = 0; row < rows - 3; row++) {
            for (let col = 0; col < columns - 3; col++) {
                if (board[row][col] !== 0 &&
                    board[row][col] === board[row + 1][col + 1] &&
                    board[row + 1][col + 1] === board[row + 2][col + 2] &&
                    board[row + 2][col + 2] === board[row + 3][col + 3]) {
                    return true;
                }
            }
        }

        for (let row = 3; row < rows; row++) {
            for (let col = 0; col < columns - 3; col++) {
                if (board[row][col] !== 0 &&
                    board[row][col] === board[row - 1][col + 1] &&
                    board[row - 1][col + 1] === board[row - 2][col + 2] &&
                    board[row - 2][col + 2] === board[row - 3][col + 3]) {
                    return true;
                }
            }
        }

        return false;
    }

    function makeMove(col, playerMove = false) {
        let madeMove = false;
        for (let row = rows - 1; row >= 0; row--) {
            if (board[row][col] === 0) {
                board[row][col] = currentPlayer === 'player' ? 1 : 2;
                const cell = document.querySelector(`.cell[data-row="${row}"][data-column="${col}"]`);
                cell.classList.add(currentPlayer === 'player' ? playerColor : aiColor);
                madeMove = true;
                break;
            }
        }
        if (!madeMove) return; // Exit if column was full and no move was made

        if (checkWin()) {
            alert(`Game Over! ${currentPlayer === 'player' ? 'Player wins!' : 'AI wins!'}`);
            currentPlayer = null; // Stop game play
            document.getElementById('loadingText').style.display = 'none';
            return;
        }

        currentPlayer = currentPlayer === 'player' ? 'ai' : 'player';
        if (playerMove && currentPlayer === 'ai') {
            document.getElementById('loadingText').style.display = 'block'; // Show loading text
            setTimeout(aiMove, 500); // AI makes a move after a short delay
        }
    }

    function aiMove() {
        let bestScore = -Infinity;
        let move = 0;
        for (let col = 0; col < columns; col++) {
            for (let row = rows - 1; row >= 0; row--) {
                if (board[row][col] === 0) {
                    board[row][col] = 2; // AI move
                    let score = minimax(board, 0, false);
                    board[row][col] = 0;
                    if (score > bestScore) {
                        bestScore = score;
                        move = col;
                    }
                    break; // ensures only the first available spot is tested
                }
            }
        }
        makeMove(move);
        document.getElementById('loadingText').style.display = 'none'; // Hide loading text after AI move
    }

    function minimax(board, depth, isMaximizing) {
        if (checkWin()) {
            return isMaximizing ? -10 : 10;
        }
        if (depth === 5) { // Limit the depth for performance
            return 0;
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let col = 0; col < columns; col++) {
                for (let row = rows - 1; row >= 0; row--) {
                    if (board[row][col] === 0) {
                        board[row][col] = 2;
                        let score = minimax(board, depth + 1, false);
                        board[row][col] = 0;
                        bestScore = Math.max(score, bestScore);
                        break;
                    }
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let col = 0; col < columns; col++) {
                for (let row = rows - 1; row >= 0; row--) {
                    if (board[row][col] === 0) {
                        board[row][col] = 1;
                        let score = minimax(board, depth + 1, true);
                        board[row][col] = 0;
                        bestScore = Math.min(score, bestScore);
                        break;
                    }
                }
            }
            return bestScore;
        }
    }

    function resetGame() {
        board = Array(rows).fill().map(() => Array(columns).fill(0));
        createBoard();
        currentPlayer = 'player';
        loadingText.style.display = 'none';
    }

    resetButton.addEventListener('click', resetGame);

    createBoard(); // Initialize the board at startup
});
