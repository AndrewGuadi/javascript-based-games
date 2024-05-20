document.addEventListener("DOMContentLoaded", () => {
    const board = document.getElementById('game-board');
    const cardValues = generateCardValues();
    const cards = [];

    for (let i = 0; i < 100; i++) {
        const card = document.createElement('div');
        card.className = 'card';
        card.textContent = cardValues[i];
        card.dataset.value = cardValues[i];
        card.addEventListener('click', () => flipCard(card));
        board.appendChild(card);
        cards.push(card);
    }

    let flippedCards = [];
    let matchesFound = 0;

    function flipCard(card) {
        if (flippedCards.length === 2 || card.classList.contains('flipped')) {
            return;
        }

        card.classList.add('flipped');
        card.style.fontSize = '24px'; // Show text when flipped
        flippedCards.push(card);

        if (flippedCards.length === 2) {
            if (flippedCards[0].dataset.value === flippedCards[1].dataset.value) {
                matchesFound++;
                flippedCards = [];
                if (matchesFound === 50) {
                    alert('Congratulations! You have matched all pairs!');
                }
            } else {
                setTimeout(() => {
                    flippedCards.forEach(card => {
                        card.classList.remove('flipped');
                        card.style.fontSize = '0px'; // Hide text again
                    });
                    flippedCards = [];
                }, 1000);
            }
        }
    }

    function generateCardValues() {
        const pairs = Array.from({ length: 50 }, (_, i) => String.fromCharCode(65 + i)); // Letters A-Y
        const cardValues = pairs.concat(pairs);
        cardValues.sort(() => Math.random() - 0.5);
        return cardValues;
    }
});
