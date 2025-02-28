// votacion.js
let places = [
    "Hooligans Alas", "DF", "Old West", "El Jardín", "Stifel",
    "CRCC", "Pocket", "Refugio", "Chante en Santa Ana CP", "La Planta",
    "Rio de J", "THC", "Zompopas", "Casa Adrian", "Casa Nino"
];

// Temporary places added for the session (reset on reload)
let tempPlaces = [];

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
    try {
        const votes = await fetchVotes();
        placeList.innerHTML = ""; // Clear the list
        const allPlaces = [...places, ...tempPlaces]; // Combine base and temp places

        allPlaces.forEach(place => {
            const li = document.createElement("li");
            li.textContent = `${place} (${votes[place] || 0} votos)`; // Show vote count
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
                    li.textContent = `${place} (${updatedVotes[place] || 0} votos)`;
                    li.classList.add("voted");
                } else {
                    alert("Ya votaste esta semana!");
                }
            });
            placeList.appendChild(li);
        });
    } catch (error) {
        console.error("Error rendering list:", error);
        placeList.innerHTML = "<li>Error loading places. Try refreshing.</li>";
    }
}

// Initial render
renderPlaceList();

addPlaceBtn.addEventListener("click", () => {
    const newPlace = newPlaceInput.value.trim();
    const allPlaces = [...places, ...tempPlaces];
    if (newPlace && !allPlaces.includes(newPlace)) {
        tempPlaces.push(newPlace); // Add to temporary list
        renderPlaceList(); // Re-render with new place
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
