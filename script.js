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

// Function to render the list with checkboxes
function renderPlaceList() {
    placeList.innerHTML = ""; // Clear the list
    places.forEach(place => {
        const li = document.createElement("li");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = place;
        const label = document.createElement("span");
        label.textContent = place;
        li.appendChild(checkbox);
        li.appendChild(label);
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
    const excluded = Array.from(placeList.querySelectorAll("input[type='checkbox']:checked")).map(cb => cb.value);
    const availablePlaces = places.filter(place => !excluded.includes(place));

    if (availablePlaces.length === 0) {
        resultDiv.textContent = "No places left to choose!";
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
