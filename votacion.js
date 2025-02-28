// votacion.js
let places = [
    "Hooligans Alas", "DF", "Old West", "El Jardín", "Stifel",
    "CRCC", "Pocket", "Refugio", "Chante en Santa Ana CP", "La Planta",
    "Rio de J", "THC", "Zompopas", "Casa Adrian", "Casa Nino"
];

// Temporary places for the session
let tempPlaces = [];

const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
const rankingList = document.getElementById("rankingList");
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");

let cachedVotes = {};

async function fetchVotes() {
    try {
        const response = await fetch("/.netlify/functions/vote", { method: "GET" });
        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const votes = await response.json();
        cachedVotes = votes;
        return votes;
    } catch (error) {
        console.error("Error fetching votes:", error);
        if (error.message.includes("404")) {
            console.log("Function not found - assuming fresh start");
            return {};
        }
        return cachedVotes;
    }
}

async function castVote(place) {
    try {
        const response = await fetch("/.netlify/functions/vote", {
            method: "POST",
            body: JSON.stringify({ place })
        });
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Vote failed: ${response.status} ${errorData || "Unknown error"}`);
        }
        const updatedVotes = await response.json();
        cachedVotes = updatedVotes;
        return updatedVotes;
    } catch (error) {
        console.error("Vote error:", error);
        if (error.message.includes("403")) {
            alert("Ya votaste esta semana!");
        } else if (error.message.includes("404")) {
            alert("Voting system not available - function not found!");
        } else {
            alert("Voting failed: " + error.message);
        }
        return null;
    }
}

function renderPlaceList(votes = cachedVotes) {
    placeList.innerHTML = "";
    const allPlaces = [...places, ...tempPlaces];

    allPlaces.forEach(place => {
        const li = document.createElement("li");
        li.textContent = place;
        li.addEventListener("click", async () => {
            const updatedVotes = await castVote(place);
            if (updatedVotes) {
                renderPlaceList(updatedVotes);
                renderRanking(updatedVotes);
            }
        });
        placeList.appendChild(li);
    });
}

function renderRanking(votes = cachedVotes) {
    rankingList.innerHTML = "";
    const sortedPlaces = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    sortedPlaces.forEach(([place, count], index) => {
        const li = document.createElement("li");
        li.textContent = `${place}: ${count} votos`;
        if (index === 0 && count > 0) { // Highlight top vote
            li.classList.add("top-voted");
        }
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
    console.error("Initial fetch failed, assuming no votes");
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
