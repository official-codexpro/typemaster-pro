
document.addEventListener("DOMContentLoaded", function () {

    const dashboardScreen = document.getElementById("dashboardScreen");
    const gameScreen = document.getElementById("gameScreen");
    const startTestButton = document.getElementById("startTestButton");

    let gameScriptLoaded = false;
    let gameScriptLoading = false;

    if (!dashboardScreen || !gameScreen || !startTestButton) {
        console.error("Dashboard elements are missing.");
        return;
    }

    startTestButton.addEventListener("click", function () {

        dashboardScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");

        if (gameScriptLoaded || gameScriptLoading) {
            return;
        }

        gameScriptLoading = true;

        const script = document.createElement("script");

        script.src = "/static/js/app.js?v=3";

        script.onload = function () {
            gameScriptLoaded = true;
            gameScriptLoading = false;
        };

        script.onerror = function () {

            console.error("Game script failed to load.");

            gameScriptLoading = false;

            dashboardScreen.classList.remove("hidden");
            gameScreen.classList.add("hidden");
        };

        document.body.appendChild(script);

    });

});
