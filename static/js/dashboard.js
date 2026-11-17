document.addEventListener("DOMContentLoaded", function () {

    const dashboardScreen = document.getElementById("dashboardScreen");
    const gameScreen = document.getElementById("gameScreen");
    const startTestButton = document.getElementById("startTestButton");

    let gameScriptLoaded = false;

    startTestButton.addEventListener("click", function () {

        dashboardScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");

        if (!gameScriptLoaded) {

            const script = document.createElement("script");

            script.src = "/static/js/app.js?v=2";

            script.onload = function () {
                gameScriptLoaded = true;
            };

            script.onerror = function () {
                alert("Game script failed to load.");
                dashboardScreen.classList.remove("hidden");
                gameScreen.classList.add("hidden");
            };

            document.body.appendChild(script);
        }

    });

});