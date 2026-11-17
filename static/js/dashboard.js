
document.addEventListener("DOMContentLoaded", function () {

    const dashboardScreen = document.getElementById("dashboardScreen");
    const gameScreen = document.getElementById("gameScreen");
    const startTestButton = document.getElementById("startTestButton");
    const codePracticeButton = document.getElementById("codePracticeButton");
    const difficultySelect = document.getElementById("difficulty");

    let gameScriptLoaded = false;
    let gameScriptLoading = false;
    let openCodeModeAfterLoad = false;

    if (!dashboardScreen || !gameScreen || !startTestButton) {
        console.error("Dashboard elements are missing.");
        return;
    }

    function activateCodeMode() {
        if (!difficultySelect) {
            console.error("Difficulty selector not found.");
            return;
        }

        difficultySelect.value = "code";

        difficultySelect.dispatchEvent(
            new Event("change", { bubbles: true })
        );
    }

    startTestButton.addEventListener("click", function () {

        dashboardScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");

        if (gameScriptLoaded) {
            return;
        }

        if (gameScriptLoading) {
            return;
        }

        gameScriptLoading = true;

        const script = document.createElement("script");
        script.src = "/static/js/app.js?v=3";

        script.onload = function () {

            gameScriptLoaded = true;
            gameScriptLoading = false;

            if (openCodeModeAfterLoad) {
                openCodeModeAfterLoad = false;
                activateCodeMode();
            }

        };

        script.onerror = function () {

            console.error("Game script failed to load.");

            gameScriptLoading = false;

            dashboardScreen.classList.remove("hidden");
            gameScreen.classList.add("hidden");

        };

        document.body.appendChild(script);

    });

    if (codePracticeButton) {

        codePracticeButton.addEventListener("click", function () {

            openCodeModeAfterLoad = true;

            if (gameScriptLoaded) {
                activateCodeMode();
                dashboardScreen.classList.add("hidden");
                gameScreen.classList.remove("hidden");
            } else {
                startTestButton.click();
            }

        });

    }

});
