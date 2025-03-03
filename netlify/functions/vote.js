let places = [];
let cachedVotes = {};

const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
const rankingList = document.getElementById("rankingList");
const newPlaceInput = document.getElementById("newPlaceInput");
const addPlaceBtn = document.getElementById("addPlaceBtn");

// 1) Carga inicial de datos (votos y lugares) desde el backend
async function fetchData() {
  try {
    const response = await fetch("/.netlify/functions/vote", { method: "GET" });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);

    const data = await response.json();
    cachedVotes = data.votes || {};
    places = data.places || [];

    // Renderiza la lista de lugares y el ranking
    renderPlaceList();
    renderRanking();
    renderWinner(); // Llamada adicional para actualizar la sección del ganador
  } catch (error) {
    console.error("Error fetching data:", error);
    cachedVotes = {};
    places = [];
    renderPlaceList();
    renderRanking();
    renderWinner();
  }
}

// 2) Función para votar por un lugar
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
    cachedVotes = data; // Actualiza los votos en cache
    renderPlaceList();
    renderRanking();
    renderWinner();

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

// 3) Función para agregar un nuevo lugar
async function addPlace(place) {
  try {
    const response = await fetch("/.netlify/functions/vote", {
      method: "PUT",
      body: JSON.stringify({ place })
    });
    if (!response.ok) throw new Error(`Add place failed: ${response.status} ${response.statusText}`);

    await fetchData(); // Recarga todos los datos
  } catch (error) {
    console.error("Add place error:", error);
    alert("Failed to add place: " + error.message);
  }
}

// 4) Función para eliminar un lugar
async function deletePlace(place) {
  try {
    const response = await fetch("/.netlify/functions/vote", {
      method: "DELETE",
      body: JSON.stringify({ place })
    });
    if (!response.ok) throw new Error(`Delete place failed: ${response.status} ${response.statusText}`);

    await fetchData(); // Recarga todos los datos
  } catch (error) {
    console.error("Delete place error:", error);
    alert("Failed to delete place: " + error.message);
  }
}

// 5) Renderizar la lista de lugares
function renderPlaceList() {
  placeList.innerHTML = "";
  if (places.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No places available.";
    placeList.appendChild(li);
    return;
  }

  places.forEach(place => {
    const li = document.createElement("li");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.classList.add("ml-2", "text-red-500", "bg-transparent", "border-none", "cursor-pointer", "hover:text-red-700");
    deleteBtn.addEventListener("click", (e) => {
      // Evita que el click de voto se dispare al hacer click en la papelera
      e.stopPropagation();
      deletePlace(place);
    });

    li.textContent = place;
    li.appendChild(deleteBtn);

    li.addEventListener("click", async () => {
      const updatedVotes = await castVote(place);
      if (updatedVotes) {
        renderPlaceList();
        renderRanking();
        renderWinner();
      }
    });

    li.classList.add(
      "flex", "items-center", "justify-between", "p-2",
      "bg-gray-700", "rounded-lg", "hover:bg-gray-600", "transition-colors"
    );
    placeList.appendChild(li);
  });
}

// 6) Renderizar el ranking
function renderRanking() {
  rankingList.innerHTML = "";
  if (Object.keys(cachedVotes).length === 0) {
    const li = document.createElement("li");
    li.textContent = "No votes yet.";
    rankingList.appendChild(li);
    return;
  }

  const sortedPlaces = Object.entries(cachedVotes).sort((a, b) => b[1] - a[1]);
  sortedPlaces.forEach(([place, count], index) => {
    const li = document.createElement("li");
    li.textContent = `${place}: ${count} votos`;
    if (index === 0 && count > 0) {
      li.classList.add("top-voted"); // Resalta el primer lugar
    }
    rankingList.appendChild(li);
  });

  // Importante: actualizar la sección del ganador
  renderWinn
