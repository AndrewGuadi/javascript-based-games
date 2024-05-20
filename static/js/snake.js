let canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');
let snakeTrail = [], snakeX = 10, snakeY = 10;
let velX = 0, velY = 0; // Start with no movement
let gridSize = 20, tileCount = 20;
let foodX, foodY; // Food coordinates to be set by placeFood function
let speed = 5; // Adjusted speed
let score = 0;
let interval;

function placeFood() {
    do {
        foodX = Math.floor(Math.random() * tileCount);
        foodY = Math.floor(Math.random() * tileCount);
    } while (snakeTrail.some(segment => segment.x === foodX && segment.y === foodY));
}

function changeDirection(e) {
    switch (e.key) {
        case 'ArrowUp':
            if (velY === 0) { velX = 0; velY = -1; }
            break;
        case 'ArrowDown':
            if (velY === 0) { velX = 0; velY = 1; }
            break;
        case 'ArrowLeft':
            if (velX === 0) { velX = -1; velY = 0; }
            break;
        case 'ArrowRight':
            if (velX === 0) { velX = 1; velY = 0; }
            break;
    }
}

function drawGame() {
    snakeX += velX;
    snakeY += velY;

    // Wrap snake position on hitting wall
    snakeX = (snakeX < 0) ? tileCount - 1 : (snakeX >= tileCount) ? 0 : snakeX;
    snakeY = (snakeY < 0) ? tileCount - 1 : (snakeY >= tileCount) ? 0 : snakeY;

    // Game over on colliding with itself, only check if there is movement
    if ((velX !== 0 || velY !== 0) && snakeTrail.some(segment => segment.x === snakeX && segment.y === snakeY)) {
        alert(`Game Over! Your score is ${score}`);
        resetGame();
        return;
    }

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'red';
    ctx.fillRect(foodX * gridSize, foodY * gridSize, gridSize, gridSize);

    ctx.fillStyle = 'green';
    snakeTrail.forEach(segment => {
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
    });

    if (snakeX === foodX && snakeY === foodY) {
        score++;
        placeFood();
    } else {
        snakeTrail.shift();
    }

    snakeTrail.push({ x: snakeX, y: snakeY });

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText("Score: " + score, canvas.width - 120, 20);
}

function resetGame() {
    clearInterval(interval);
    snakeTrail = [];
    snakeX = snakeY = 10;
    velX = velY = 0;
    score = 0;
    placeFood();
    interval = setInterval(drawGame, 1000 / speed); // Reset interval with new speed
}

document.addEventListener('keydown', changeDirection);
resetGame(); // Initialize the game
