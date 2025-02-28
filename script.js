const places = [
    "Hooligans Alas", "DF", "Old West", "El Jardín", "Stifel",
    "CRCC", "Pocket", "Refugio", "Chante en Santa Ana CP", "La Planta",
    "Rio de J", "THC", "Zompopas", "Casa Adrian", "Casa Nino"
];
const decideBtn = document.getElementById("decideBtn");
const resultDiv = document.getElementById("result");
const placeList = document.getElementById("placeList");
places.forEach(place => {
    const li = document.createElement("li");
    li.textContent = place;
    placeList.appendChild(li);
});
decideBtn.addEventListener("click", () => {
    resultDiv.textContent = "Pensando...";
    resultDiv.classList.remove("reveal");
    let shuffleCount = 0;
    const shuffleInterval = setInterval(() => {
        const randomPlace = places[Math.floor(Math.random() * places.length)];
        resultDiv.textContent = randomPlace;
        shuffleCount++;
        if (shuffleCount > 10) {
            clearInterval(shuffleInterval);
            const winner = places[Math.floor(Math.random() * places.length)];
            resultDiv.textContent = `¡Vamos a ${winner}!`;
            resultDiv.classList.add("reveal");
        }
    }, 100);
});
