// script.js
let places = [
    "Hooligans Alas", "DF", "Old West", "El Jardín", "Stifel",
    "CRCC", "Pocket", "Refugio", "Chante en Santa Ana CP", "La Planta",
    "Rio de J", "THC", "Zompopas", "Casa Adrian", "Casa Nino"
];

const decideBtn = document.getElementById("decideBtn");
const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");

// Function to render the list with highlighted boxes
function renderPlaceList() {
    placeList.innerHTML = ""; // Clear the list
    places.forEach(place => {
        const li = document.createElement("li");
        li.textContent = place;
        li.classList.add("selected"); // Start highlighted
        li.addEventListener("click", () => {
            li.classList.toggle("deselected"); // Toggle deselection
        });
        placeList.appendChild(li);
    });
}

// Initial render
renderPlaceList();

// Add new place
addPlaceBtn.addEventListener("click", () => {
    const newPlace = newPlaceInput.value.trim();
    if (newPlace && !places.includes(newPlace)) {
        places.push(newPlace);
        renderPlaceList();
        newPlaceInput.value = ""; // Clear input
    }
});

// Randomizer with exclusions
decideBtn.addEventListener("click", () => {
    const deselected = Array.from(placeList.querySelectorAll("li.deselected")).map(li => li.textContent);
    const availablePlaces = places.filter(place => !deselected.includes(place));

    if (availablePlaces.length === 0) {
        resultDiv.textContent = "No places left to choose!";
        resultDiv.classList.remove("reveal");
        return;
    }

    resultDiv.textContent = "Pensando...";
    resultDiv.classList.remove("reveal");

    let shuffleCount = 0;
    const shuffleInterval = setInterval(() => {
        const randomPlace = availablePlaces[Math.floor(Math.random() * availablePlaces.length)];
        resultDiv.textContent = randomPlace;
        shuffleCount++;
        if (shuffleCount > 10) {
            clearInterval(shuffleInterval);
            const winner = availablePlaces[Math.floor(Math.random() * availablePlaces.length)];
            resultDiv.textContent = `¡Vamos a ${winner}!`;
            resultDiv.classList.add("reveal");
        }
    }, 100);
});
