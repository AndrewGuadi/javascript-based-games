document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('minesweeper-board');
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Game';
    resetButton.onclick = resetGame;
    document.body.insertBefore(resetButton, boardElement.nextSibling);

    let rows = 10;
    let cols = 10;
    let mineCount = 15;
    let gameOver = false;
    let boardData = generateBoard(rows, cols, mineCount);
    createBoard();

    function generateBoard(rows, cols, mineCount) {
        let board = Array.from({ length: rows }, () =>
            Array(cols).fill(null).map(() => ({
                mine: false,
                revealed: false,
                flagged: false,
                adjacentMines: 0
            }))
        );

        placeMines(board, rows, cols, mineCount);
        calculateMines(board, rows, cols);
        return board;
    }

    function placeMines(board, rows, cols, mineCount) {
        let minesPlaced = 0;
        while (minesPlaced < mineCount) {
            let row = Math.floor(Math.random() * rows);
            let col = Math.floor(Math.random() * cols);
            if (!board[row][col].mine) {
                board[row][col].mine = true;
                minesPlaced++;
            }
        }
    }

    function calculateMines(board, rows, cols) {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (board[row][col].mine) continue;
                let adjacent = 0;
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        let checkRow = row + i;
                        let checkCol = col + j;
                        if (checkRow >= 0 && checkRow < rows && checkCol >= 0 && checkCol < cols && board[checkRow][checkCol].mine) {
                            adjacent++;
                        }
                    }
                }
                board[row][col].adjacentMines = adjacent;
            }
        }
    }

    function createBoard() {
        boardElement.innerHTML = ''; // Clear the board first
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const cell = document.createElement('div');
                cell.className = 'cell unrevealed';
                cell.dataset.row = i;
                cell.dataset.col = j;
                cell.addEventListener('click', () => revealCell(cell));
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    toggleFlag(cell);
                });
                boardElement.appendChild(cell);
            }
        }
    }

    function revealCell(cell) {
        if (gameOver) return;
        const row = parseInt(cell.dataset.row, 10);
        const col = parseInt(cell.dataset.col, 10);
        const cellData = boardData[row][col];

        if (cellData.revealed || cellData.flagged) return;

        cellData.revealed = true;
        cell.className = 'cell revealed';

        if (cellData.mine) {
            cell.classList.add('mine');
            cell.innerHTML = '💣';
            gameOver = true;
            setTimeout(() => {
                alert('Game Over!');
                // Optionally automatically reset the game here
            }, 100);
        } else {
            cell.innerHTML = cellData.adjacentMines > 0 ? cellData.adjacentMines : '';
            if (cellData.adjacentMines === 0) {
                revealAdjacentCells(row, col);
            }
        }
    }

    function revealAdjacentCells(row, col) {
        if (gameOver) return;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                let checkRow = row + i;
                let checkCol = col + j;
                if (checkRow >= 0 && checkRow < rows && checkCol >= 0 && checkCol < cols) {
                    let adjacentCell = document.querySelector(`.cell[data-row="${checkRow}"][data-col="${checkCol}"]`);
                    if (!boardData[checkRow][checkCol].revealed) revealCell(adjacentCell);
                }
            }
        }
    }

    function toggleFlag(cell) {
        if (gameOver) return;
        const row = parseInt(cell.dataset.row, 10);
        const col = parseInt(cell.dataset.col, 10);
        const cellData = boardData[row][col];

        if (cellData.revealed) return;

        cellData.flagged = !cellData.flagged;
        if (cellData.flagged) {
            cell.classList.add('flagged');
            cell.innerHTML = '🚩';
        } else {
            cell.classList.remove('flagged');
            cell.innerHTML = '';
        }
    }

    function resetGame() {
        gameOver = false;
        boardData = generateBoard(rows, cols, mineCount);
        createBoard();
    }
});

