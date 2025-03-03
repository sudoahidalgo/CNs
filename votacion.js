let places = [];
let cachedVotes = {};

const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
const rankingList = document.getElementById("rankingList");
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");

async function fetchData() {
  try {
    const response = await fetch("/.netlify/functions/vote", { method: "GET" });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    const data = await response.json();
    cachedVotes = data.votes || {};
    places = data.places || [];
    renderPlaceList();
    renderRanking();
  } catch (error) {
    console.error("Error fetching data:", error);
    cachedVotes = {};
    places = []; // Usa una lista predeterminada si falla
    renderPlaceList();
    renderRanking();
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
    return data;
  } catch (error) {
    console.error("Vote error:", error);
    if (error.message.includes("403")) {
      alert("Ya votaste esta semana! 😕");
    } else {
      alert("Voting failed: " + error.message + " 😢");
    }
    return null;
  }
}

async function addPlace(place) {
  try {
    const response = await fetch("/.netlify/functions/vote", {
      method: "PUT",
      body: JSON.stringify({ place })
    });
    if (!response.ok) throw new Error(`Add place failed: ${response.status} ${response.statusText}`);
    await fetchData(); // Recarga todos los datos después de agregar
  } catch (error) {
    console.error("Add place error:", error);
    alert("Failed to add place: " + error.message + " 😢");
  }
}

async function deletePlace(place) {
  try {
    const response = await fetch("/.netlify/functions/vote", {
      method: "DELETE",
      body: JSON.stringify({ place })
    });
    if (!response.ok) throw new Error(`Delete place failed: ${response.status} ${response.statusText}`);
    await fetchData(); // Recarga todos los datos después de eliminar
  } catch (error) {
    console.error("Delete place error:", error);
    alert("Failed to delete place: " + error.message + " 😢");
  }
}

function renderPlaceList() {
  placeList.innerHTML = "";
  if (places.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No places available. 😕";
    placeList.appendChild(li);
    return;
  }
  places.forEach(place => {
    const li = document.createElement("li");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.classList.add("ml-2", "text-red-500", "bg-transparent", "border-none", "cursor-pointer", "hover:text-red-700");
    deleteBtn.addEventListener("click", () => deletePlace(place));
    li.textContent = `${place} 🌍`; // Añade un emoji al nombre del lugar
    li.appendChild(deleteBtn);
    li.addEventListener("click", async () => {
      const updatedVotes = await castVote(place);
      if (updatedVotes) {
        renderPlaceList();
        renderRanking();
      }
    });
    li.classList.add("flex", "items-center", "justify-between", "p-2", "bg-gray-700", "rounded-lg", "hover:bg-gray-600", "transition-colors");
    placeList.appendChild(li);
  });
}

function renderRanking() {
  rankingList.innerHTML = "";
  if (Object.keys(cachedVotes).length === 0) {
    const li = document.createElement("li");
    li.textContent = "No votes yet. 🗳️";
    rankingList.appendChild(li);
    return;
  }
  const sortedPlaces = Object.entries(cachedVotes).sort((a, b) => b[1] - a[1]);
  sortedPlaces.forEach(([place, count], index) => {
    const li = document.createElement("li");
    li.textContent = `${place} 🎉: ${count} votos`;
    if (index === 0 && count > 0) { // Highlight top vote
      li.classList.add("top-voted");
    }
    rankingList.appendChild(li);
  });
}

// Initial setup
fetchData().catch(() => console.error("Initial fetch failed 😢"));

// Add place event listener
addPlaceBtn.addEventListener("click", () => {
  const newPlace = newPlaceInput.value.trim();
  if (newPlace && !places.includes(newPlace)) {
    addPlace(newPlace);
    newPlaceInput.value = "";
  }
});
