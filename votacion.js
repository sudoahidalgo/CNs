// votacion.js
let places = [
    "Hooligans Alas", "DF", "Old West", "El Jardín", "Stifel",
    "CRCC", "Pocket", "Refugio", "Chante en Santa Ana CP", "La Planta",
    "Rio de J", "THC", "Zompopas", "Casa Adrian", "Casa Nino"
];

// Temporary places for the session
let tempPlaces = [];

const showResultsBtn = document.getElementById("showResultsBtn");
const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
const rankingList = document.getElementById("rankingList");
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");

let cachedVotes = {}; // Synced with server votes

async function fetchVotes() {
    try {
        const response = await fetch("/.netlify/functions/vote", { method: "GET" });
        if (!response.ok) throw new Error("Fetch failed: " + response.status);
        const votes = await response.json();
        cachedVotes = votes;
        return votes;
    } catch (error) {
        console.error("Error fetching votes:", error);
        alert("Error loading votes: " + error.message); // User feedback
        return cachedVotes;
    }
}

function renderPlaceList(votes = cachedVotes) {
    placeList.innerHTML = ""; // Clear options
    const allPlaces = [...places, ...tempPlaces];

    allPlaces.forEach(place => {
        const li = document.createElement("li");
        li.textContent = place; // Just the name, no votes here
        li.addEventListener("click", async () => {
            try {
                const response = await fetch("/.netlify/functions/vote", {
                    method: "POST",
                    body: JSON.stringify({ place })
                });
                if (response.ok) {
                    const updatedVotes = await response.json();
                    cachedVotes = updatedVotes;
                    renderPlaceList(updatedVotes);
                    renderRanking(updatedVotes); // Update ranking
                } else {
                    const error = await response.json();
                    alert(error.error || "Ya votaste esta semana!");
                }
            } catch (error) {
                console.error("Vote error:", error);
                alert("Voting failed: " + error.message);
            }
        });
        placeList.appendChild(li);
    });
}

function renderRanking(votes = cachedVotes) {
    rankingList.innerHTML = ""; // Clear ranking
    const sortedPlaces = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    sortedPlaces.forEach(([place, count]) => {
        const li = document.createElement("li");
        li.textContent = `${place}: ${count} votos`;
        rankingList.appendChild(li);
    });
}

// Initial render
renderPlaceList();
renderRanking();

// Fetch votes and re-render
fetchVotes().then(votes => {
    renderPlaceList(votes);
    renderRanking(votes);
}).catch(() => {
    console.error("Initial fetch failed, using fallback");
});

addPlaceBtn.addEventListener("click", () => {
    const newPlace = newPlaceInput.value.trim();
    const allPlaces = [...places, ...tempPlaces];
    if (newPlace && !allPlaces.includes(newPlace)) {
        tempPlaces.push(newPlace);
        renderPlaceList(cachedVotes);
        renderRanking(cachedVotes);
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
