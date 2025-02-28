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
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");

let cachedVotes = {}; // Synced with server votes

async function fetchVotes() {
    try {
        const response = await fetch("/.netlify/functions/vote", { method: "GET" });
        if (!response.ok) throw new Error("Fetch failed: " + response.status);
        const votes = await response.json();
        console.log("Fetched votes:", votes); // Debug log
        cachedVotes = votes; // Sync cache with server
        return votes;
    } catch (error) {
        console.error("Error fetching votes:", error);
        return cachedVotes; // Fallback to last known votes
    }
}

function renderPlaceList(votes = cachedVotes) {
    placeList.innerHTML = ""; // Clear the list
    const allPlaces = [...places, ...tempPlaces]; // Combine base and temp places

    allPlaces.forEach(place => {
        const li = document.createElement("li");
        li.textContent = `${place} (${votes[place] || 0} votos)`; // Show vote count
        li.addEventListener("click", async () => {
            const response = await fetch("/.netlify/functions/vote", {
                method: "POST",
                body: JSON.stringify({ place })
            });
            if (response.ok) {
                const updatedVotes = await response.json();
                console.log("Vote recorded, updated votes:", updatedVotes); // Debug log
                cachedVotes = updatedVotes; // Update cache
                renderPlaceList(updatedVotes); // Re-render with fresh votes
            } else {
                console.log("Vote rejected, response:", await response.json()); // Debug log
                alert("Ya votaste esta semana!");
            }
        });
        placeList.appendChild(li);
    });
}

// Initial render with fallback
renderPlaceList();

// Fetch votes and re-render
fetchVotes().then(votes => {
    renderPlaceList(votes);
}).catch(() => {
    console.error("Initial fetch failed, using fallback");
});

addPlaceBtn.addEventListener("click", () => {
    const newPlace = newPlaceInput.value.trim();
    const allPlaces = [...places, ...tempPlaces];
    if (newPlace && !allPlaces.includes(newPlace)) {
        tempPlaces.push(newPlace); // Add to temporary list
        renderPlaceList(cachedVotes); // Re-render with current votes
        newPlaceInput.value = ""; // Clear input
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
