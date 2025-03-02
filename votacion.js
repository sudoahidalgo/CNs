let places = [];

const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
const rankingList = document.getElementById("rankingList");
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");

let cachedVotes = {};

async function fetchVotes() {
  try {
    const response = await fetch("/.netlify/functions/vote", { method: "GET" });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    const votes = await response.json();
    cachedVotes = votes;
    return votes;
  } catch (error) {
    console.error("Error fetching votes:", error);
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
    } else {
      alert("Voting failed: " + error.message);
    }
    return null;
  }
}

async function fetchPlaces() {
  try {
    const response = await fetch("/.netlify/functions/vote", {
      method: "GET", // Reutilizamos GET por ahora, pero puedes crear un endpoint separado
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    const placesData = await response.json(); // Ajusta según el formato que devuelva tu endpoint
    places = placesData.map(place => place.name); // Ajusta según la estructura de datos
    renderPlaceList(cachedVotes);
    renderRanking(cachedVotes);
  } catch (error) {
    console.error("Error fetching places:", error);
    places = []; // Usa una lista predeterminada si falla
  }
}

async function addPlace(place) {
  try {
    const response = await fetch("/.netlify/functions/vote", {
      method: "PUT", // Crear un nuevo endpoint PUT en vote.js para agregar lugares
      body: JSON.stringify({ place })
    });
    if (!response.ok) throw new Error(`Add place failed: ${response.status} ${response.statusText}`);
    await fetchPlaces(); // Recarga los lugares después de agregar
  } catch (error) {
    console.error("Add place error:", error);
    alert("Failed to add place: " + error.message);
  }
}

async function deletePlace(place) {
  try {
    const response = await fetch("/.netlify/functions/vote", {
      method: "DELETE", // Crear un nuevo endpoint DELETE en vote.js para eliminar lugares
      body: JSON.stringify({ place })
    });
    if (!response.ok) throw new Error(`Delete place failed: ${response.status} ${response.statusText}`);
    await fetchPlaces(); // Recarga los lugares después de eliminar
  } catch (error) {
    console.error("Delete place error:", error);
    alert("Failed to delete place: " + error.message);
  }
}

function renderPlaceList(votes = cachedVotes) {
  placeList.innerHTML = "";
  places.forEach(place => {
    const li = document.createElement("li");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";
    deleteBtn.classList.add("ml-2", "text-red-500");
    deleteBtn.addEventListener("click", () => deletePlace(place));
    li.textContent = place;
    li.appendChild(deleteBtn);
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

// Initial setup
fetchPlaces().then(() => {
  renderPlaceList();
  renderRanking();
}).catch(() => console.error("Initial fetch failed, assuming no places"));

fetchVotes().then(votes => {
  renderPlaceList(votes);
  renderRanking(votes);
}).catch(() => console.error("Initial fetch failed, assuming no votes"));

addPlaceBtn.addEventListener("click", () => {
  const newPlace = newPlaceInput.value.trim();
  if (newPlace && !places.includes(newPlace)) {
    addPlace(newPlace);
    newPlaceInput.value = "";
  }
});
