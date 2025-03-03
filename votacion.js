let places = [];
let cachedVotes = {};
let winners = [];

const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
const rankingList = document.getElementById("rankingList");
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");
const winnersList = document.getElementById("winnersList");

async function fetchData() {
  try {
    const response = await fetch("/.netlify/functions/vote", { method: "GET" });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    const data = await response.json();
    cachedVotes = data.votes || {};
    places = data.places || [];
    winners = data.winners || [];
    renderPlaceList();
    renderRanking();
    renderWinners();
  } catch (error) {
    console.error("Error fetching data:", error);
    cachedVotes = {};
    places = [];
    winners = [];
    renderPlaceList();
    renderRanking();
    renderWinners();
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
    const data = await response.json();
    cachedVotes = data;
    renderPlaceList();
    renderRanking();
    await fetchData(); // Recargar datos incluyendo ganadores
    return data;
  } catch (error) {
    console.error("Vote error:", error);
    if (error.message.includes("403")) {
      alert("Ya votaste esta semana!");
    } else {
      alert("Voting failed: " + error.message);
    }
    return null;
  }
}

// ... (las funciones addPlace, deletePlace, renderPlaceList y renderRanking permanecen igual)

function renderWinners() {
  winnersList.innerHTML = "";
  if (winners.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No winners recorded yet.";
    winnersList.appendChild(li);
    return;
  }
  winners.forEach(winner => {
    const li = document.createElement("li");
    const date = new Date(winner.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    li.textContent = `${winner.place.padEnd(20, '.')}${date}`;
    winnersList.appendChild(li);
  });
}

// Initial setup
fetchData().catch(() => console.error("Initial fetch failed"));

addPlaceBtn.addEventListener("click", () => {
  const newPlace = newPlaceInput.value.trim();
  if (newPlace && !places.includes(newPlace)) {
    addPlace(newPlace);
    newPlaceInput.value = "";
  }
});
