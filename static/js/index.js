document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.querySelector('.game-board');
    const playAgainButton = document.querySelector('#play-again');
    let currentPlayer = 'X';
    let gameOver = false;
    let gameCells;

    function createGameBoard() {
        gameBoard.innerHTML = '';  // Clear existing board if any
        for (let i = 0; i < 9; i++) {
            const gameCell = document.createElement('div');
            gameCell.classList.add('game-cell');
            gameCell.addEventListener('click', playerMove); // Add event listener here
            gameBoard.appendChild(gameCell);
        }
        gameCells = document.querySelectorAll('.game-cell');  // Update the cells after creating them
    }

    function playerMove(event) {
        if (gameOver || event.target.textContent !== '') return;
        event.target.textContent = currentPlayer;
        if (checkWin()) {
            alert(`Game Over! ${currentPlayer} wins!`);
            gameOver = true;
            return;
        }
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        if (currentPlayer === 'O') aiMove();
    }

    function aiMove() {
        const bestMove = getBestMove();  // This should be defined to make a decision
        if (bestMove !== -1) {
            gameCells[bestMove].textContent = 'O';
            if (checkWin()) {
                alert(`Game Over! O wins!`);
                gameOver = true;
                return;
            }
            currentPlayer = 'X';
        }
    }

    function checkWin() {
        const winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6],
            [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]
        ];
        return winningCombinations.some(combination => {
            const [a, b, c] = combination;
            if (gameCells[a].textContent && gameCells[a].textContent === gameCells[b].textContent && gameCells[b].textContent === gameCells[c].textContent) {
                return true;
            }
            return false;
        });
    }

    function getBestMove() {
        // Implement your logic here, like using minimax
        for (let i = 0; i < gameCells.length; i++) {
            if (gameCells[i].textContent === '') {
                return i;  // Simplistic move picker, replace with your minimax logic
            }
        }
        return -1;
    }

    playAgainButton.addEventListener('click', () => {
        gameOver = false;
        currentPlayer = 'X';
        createGameBoard();
    });

    createGameBoard();
});