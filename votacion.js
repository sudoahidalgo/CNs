// votacion.js
let places = [
    "Hooligans Alas", "DF", "Old West", "El Jardín", "Stifel",
    "CRCC", "Pocket", "Refugio", "Chante en Santa Ana CP", "La Planta",
    "Rio de J", "THC", "Zompopas", "Casa Adrian", "Casa Nino"
];

const showResultsBtn = document.getElementById("showResultsBtn");
const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");

async function fetchVotes() {
    const response = await fetch("/.netlify/functions/vote", { method: "GET" });
    return await response.json();
}

async function renderPlaceList() {
    const votes = await fetchVotes();
    placeList.innerHTML = "";
    places.forEach(place => {
        const li = document.createElement("li");
        li.textContent = `${place} (${votes[place] || 0})`;
        li.addEventListener("click", async () => {
            const today = new Date().getDay();
            if (today !== 2) { // 2 = Tuesday
                alert("Voting is only available on Tuesdays!");
                return;
            }
            const response = await fetch("/.netlify/functions/vote", {
                method: "POST",
                body: JSON.stringify({ place })
            });
            if (response.ok) {
                const updatedVotes = await response.json();
                li.textContent = `${place} (${updatedVotes[place] || 0})`;
                li.classList.add("voted");
            } else {
                alert("Ya votaste esta semana!");
            }
        });
        placeList.appendChild(li);
    });
}

renderPlaceList();

addPlaceBtn.addEventListener("click", () => {
    const newPlace = newPlaceInput.value.trim();
    if (newPlace && !places.includes(newPlace)) {
        places.push(newPlace);
        renderPlaceList();
        newPlaceInput.value = "";
    }
});

showResultsBtn.addEventListener("click", async () => {
    const votes = await fetchVotes();
    const sortedPlaces = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    if (sortedPlaces.length === 0) {
        resultDiv.textContent = "No votes yet!";
    } else {
        const winner = sortedPlaces[0];
        resultDiv.textContent = `¡Ganador: ${winner[0]} con ${winner[1]} votos!`;
    }
    resultDiv.classList.add("reveal");
});
