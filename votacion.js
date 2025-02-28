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

let cachedVotes = {}; // Fallback if fetch fails

async function fetchVotes() {
    try {
        const response = await fetch("/.netlify/functions/vote", { method: "GET" });
        if (!response.ok) throw new Error("Fetch failed");
        return await response.json();
    } catch (error) {
        console.error("Error fetching votes:", error);
        return cachedVotes; // Use cached votes as fallback
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
                cachedVotes = updatedVotes; // Update cache
                li.textContent = `${place} (${updatedVotes[place] || 0} votos)`;
                li.classList.add("voted");
            } else {
                alert("Ya votaste esta semana!");
            }
        });
        placeList.appendChild(li);
    });
}

// Initial render with fallback
renderPlaceList(); // Show list immediately with cached votes

// Fetch votes and re-render
fetchVotes().then(votes => {
    cachedVotes = votes;
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
    cachedVotes = votes; // Update cache
    const sortedPlaces = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    if (sortedPlaces.length === 0) {
        resultDiv.textContent = "No votes yet!";
    } else {
        const winner = sortedPlaces[0];
        resultDiv.textContent = `¡Ganador: ${winner[0]} con ${winner[1]} votos!`;
    }
    resultDiv.classList.add("reveal");
});
