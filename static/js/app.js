
// ==================================================
// TYPEMASTER PRO — COMPLETE GAME ENGINE
// Django + NLTK + GSAP
// ==================================================
// 1. DOM ELEMENTS

const textDisplay = document.getElementById("textDisplay");
const typingInput = document.getElementById("typingInput");
const typingArea = document.getElementById("typingArea");

const pacman = document.getElementById("pacman");
const pacmanFace = document.getElementById("pacmanFace");
const pacmanMouth = document.getElementById("pacmanMouth");

const timerDisplay = document.getElementById("timer");
const progressBar = document.getElementById("timeProgress");

const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const mistakesDisplay = document.getElementById("mistakes");

const difficultySelect = document.getElementById("difficulty");
const durationSelect = document.getElementById("duration");
const restartButton = document.getElementById("restart");

// Result elements
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const resultWpm = document.getElementById("resultWpm");
const resultAccuracy = document.getElementById("resultAccuracy");
const resultCorrect = document.getElementById("resultCorrect");
const resultMistakes = document.getElementById("resultMistakes");

const retestDuration = document.getElementById("retestDuration");
const retestButton = document.getElementById("retestButton");
const homeButton = document.getElementById("homeButton");


// 2. VALIDATION

if (typeof gsap === "undefined") {
    throw new Error("GSAP failed to load!");
}

const requiredElements = [
    textDisplay, typingInput, typingArea,
    pacman, pacmanFace, pacmanMouth,
    timerDisplay, progressBar,
    wpmDisplay, accuracyDisplay, mistakesDisplay,
    difficultySelect, durationSelect, restartButton,
    gameScreen, resultScreen,
    resultWpm, resultAccuracy, resultCorrect, resultMistakes,
    retestDuration, retestButton, homeButton
];

if (requiredElements.some(element => !element)) {
    throw new Error("Required HTML elements are missing!");
}


// 3. GAME VARIABLES

let currentSentence = "";
let currentIndex = 0;

let totalTyped = 0;
let correctTyped = 0;
let mistakes = 0;

let totalTime = 30;
let timeLeft = 30;

let timerInterval = null;

let gameStarted = false;
let gameOver = false;
let passageLoading = false;

let passageRequestId = 0;

let recoveryProgress = 5;

const recoverySteps = 5;

const normalColor = "#FACC15";
const errorColor = "#EF4444";

// Scroll tracking
let nextScrollLine = 2;
let scrollInProgress = false;


// 4. PACMAN EATING ANIMATION

function eatAnimation() {

    gsap.killTweensOf(pacmanMouth);

    gsap.timeline()
        .to(pacmanMouth, {
            attr: {
                points: "50,50 100,49 100,51"
            },
            duration: 0.07
        })
        .to(pacmanMouth, {
            attr: {
                points: "50,50 100,25 100,75"
            },
            duration: 0.09
        });

}


// 5. ERROR ANIMATION

function errorAnimation() {

    recoveryProgress = 0;

    gsap.to(pacmanFace, {
        fill: errorColor,
        duration: 0.12
    });

    const svg = pacman.querySelector("svg");

    gsap.killTweensOf(svg);

    gsap.fromTo(svg,
        {
            y: 0,
            rotation: 0
        },
        {
            y: -13,
            rotation: -12,
            duration: 0.12,
            repeat: 1,
            yoyo: true,
            ease: "power2.out",
            onComplete: () => {
                gsap.set(svg, {
                    y: 0,
                    rotation: 0
                });
            }
        }
    );

}


// 6. COLOR RECOVERY

function recoverPacman() {

    if (recoveryProgress < recoverySteps) {
        recoveryProgress++;
    }

    const progress = recoveryProgress / recoverySteps;

    const newColor = gsap.utils.interpolate(
        errorColor,
        normalColor,
        progress
    );

    gsap.to(pacmanFace, {
        fill: newColor,
        duration: 0.45
    });

}


// 7. DJANGO PASSAGE API

async function getRandomSentence() {

    const difficulty = difficultySelect.value;

    const response = await fetch(
        `/api/generate/?difficulty=${encodeURIComponent(difficulty)}`,
        {
            credentials: "same-origin"
        }
    );

    if (!response.ok) {
        throw new Error("Passage API failed!");
    }

    const data = await response.json();

    if (!data.success || !data.text) {
        throw new Error("Invalid passage received!");
    }

    return data.text;

}


// 8. LOAD PASSAGE

async function loadSentence() {

    const requestId = ++passageRequestId;

    passageLoading = true;
    typingInput.disabled = true;

    textDisplay.textContent = "Generating new passage...";

    gsap.killTweensOf(textDisplay);

    textDisplay.scrollTop = 0;

    scrollInProgress = false;
    nextScrollLine = 2;

    try {

        const passage = await getRandomSentence();

        if (requestId !== passageRequestId) return;

        currentSentence = passage;
        currentIndex = 0;

        textDisplay.innerHTML = "";

        currentSentence.split("").forEach(character => {

            const span = document.createElement("span");

            span.textContent = character;
            span.className = "text-neutral-300";

            textDisplay.appendChild(span);

        });

        passageLoading = false;
        typingInput.disabled = false;

        requestAnimationFrame(() => {
            updatePacman();
        });

        typingInput.focus();

    } catch (error) {

        if (requestId !== passageRequestId) return;

        console.error("Passage loading error:", error);

        textDisplay.textContent =
            "Unable to generate passage. Please restart.";

        passageLoading = true;
        typingInput.disabled = true;

    }

}


// 9. PACMAN POSITION

function updatePacman() {

    const character = textDisplay.children[currentIndex];

    if (!character) return;

    const areaRect = typingArea.getBoundingClientRect();
    const charRect = character.getBoundingClientRect();

    const x = charRect.left - areaRect.left - 42;

    const y = charRect.top - areaRect.top +
        (charRect.height - 42) / 2;

    gsap.to(pacman, {
        x,
        y,
        duration: 0.12,
        ease: "power2.out",
        overwrite: "auto"
    });

}


// 10. TWO-LINE SCROLLING SYSTEM

function scrollTypingWindow() {

    const nextCharacter = textDisplay.children[currentIndex];

    if (!nextCharacter || scrollInProgress) {
        updatePacman();
        return;
    }

    const lineHeight = parseFloat(
        getComputedStyle(textDisplay).lineHeight
    );

    const displayRect = textDisplay.getBoundingClientRect();
    const characterRect = nextCharacter.getBoundingClientRect();

    const characterTop =
        characterRect.top - displayRect.top + textDisplay.scrollTop;

    const currentLine = Math.floor(
        (characterTop + 1) / lineHeight
    );

    if (currentLine >= nextScrollLine) {

        scrollInProgress = true;

        nextScrollLine += 2;

        const targetScroll = textDisplay.scrollTop +
            (lineHeight * 2);

        gsap.killTweensOf(textDisplay);

        gsap.to(textDisplay, {
            scrollTop: targetScroll,
            duration: 0.35,
            ease: "power1.inOut",

            onUpdate: () => {
                updatePacman();
            },

            onComplete: () => {
                scrollInProgress = false;
                updatePacman();
            }
        });

    } else {

        updatePacman();

    }

}


// 11. TIMER

function startTimer() {

    if (gameStarted || gameOver || passageLoading) return;

    gameStarted = true;

    timerInterval = setInterval(() => {

        if (gameOver) return;

        timeLeft--;

        timerDisplay.textContent = timeLeft;

        progressBar.style.width =
            (timeLeft / totalTime * 100) + "%";

        if (timeLeft <= 0) {
            endGame();
        }

    }, 1000);

}


// 12. TYPING ENGINE

typingInput.addEventListener("keydown", function(event) {

    if (gameOver || passageLoading) return;

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key.length !== 1) return;

    event.preventDefault();

    const characterElement = textDisplay.children[currentIndex];

    if (!characterElement) return;

    startTimer();

    const typedCharacter = event.key;
    const expectedCharacter = currentSentence[currentIndex];

    totalTyped++;

    // CORRECT CHARACTER

    if (typedCharacter === expectedCharacter) {

        correctTyped++;

        characterElement.style.visibility = "hidden";

        characterElement.classList.remove("text-red-500");

        recoverPacman();
        eatAnimation();

        currentIndex++;

        updateStats();

        if (currentIndex >= currentSentence.length) {

            loadSentence();

        } else {

            scrollTypingWindow();

        }

    }

    // WRONG CHARACTER

    else {

        mistakes++;

        characterElement.classList.add("text-red-500");

        errorAnimation();

        updateStats();

    }

});


// 13. LIVE STATISTICS

function updateStats() {

    const elapsedTime = totalTime - timeLeft;
    const minutes = elapsedTime / 60;

    const wpm = minutes > 0
        ? Math.round((correctTyped / 5) / minutes)
        : 0;

    const accuracy = totalTyped > 0
        ? Math.round((correctTyped / totalTyped) * 100)
        : 100;

    wpmDisplay.textContent = wpm;
    accuracyDisplay.textContent = accuracy + "%";
    mistakesDisplay.textContent = mistakes;

}


// 14. SAVE TEST RESULT TO DJANGO DATABASE

function getCSRFToken() {

    const cookie = document.cookie
        .split("; ")
        .find(row => row.startsWith("csrftoken="));

    return cookie
        ? decodeURIComponent(cookie.split("=")[1])
        : "";

}


async function saveTestResult(wpm, accuracy, correct, mistakes) {

    try {

        
        console.log("Sending result to Django...");

        const response = await fetch("/api/save-result/", {

            method: "POST",

            credentials: "same-origin",

            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCSRFToken()
            },

            body: JSON.stringify({

                wpm: wpm,
                accuracy: accuracy,
                correct_characters: correct,
                mistakes: mistakes,
                duration: totalTime,
                difficulty: difficultySelect.value

            })

        });

        console.log("Save API status:", response.status);

        const data = await response.json();

        if (response.status === 401) {

            console.log("Login required to save test results.");

            return false;

        }

        if (!response.ok || !data.success) {

            throw new Error(
                data.message || "Result saving failed."
            );

        }

        console.log(
            "Test result saved successfully!",
            data.result_id
        );

        return true;

    } catch (error) {

        console.error("Result save error:", error);

        return false;

    }

}


// 15. RESULT SCREEN

async function endGame() {

    if (gameOver) return;

    clearInterval(timerInterval);

    gameOver = true;

    typingInput.disabled = true;
    typingInput.blur();

    timerDisplay.textContent = "0";
    progressBar.style.width = "0%";

    // Final calculations

    const elapsedMinutes = totalTime / 60;

    const finalWpm = elapsedMinutes > 0
        ? Math.round((correctTyped / 5) / elapsedMinutes)
        : 0;

    const finalAccuracy = totalTyped > 0
        ? Math.round((correctTyped / totalTyped) * 100)
        : 100;

    // Save result before displaying result screen

    
await saveTestResult(
        finalWpm,
        finalAccuracy,
        correctTyped,
        mistakes
    );

    // Display results

    resultWpm.textContent = finalWpm;
    resultAccuracy.textContent = finalAccuracy + "%";
    resultCorrect.textContent = correctTyped;
    resultMistakes.textContent = mistakes;

    // Keep current duration selected

    retestDuration.value = String(totalTime);

    // Switch screens

    gameScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// 16. RESET GAME

async function resetGame() {

    clearInterval(timerInterval);

    // Cancel previous API requests

    passageRequestId++;

    gsap.killTweensOf(textDisplay);
    gsap.killTweensOf(pacman);
    gsap.killTweensOf(pacmanFace);
    gsap.killTweensOf(pacmanMouth);
    gsap.killTweensOf(pacman.querySelector("svg"));

    totalTime = Number(durationSelect.value);
    timeLeft = totalTime;

    totalTyped = 0;
    correctTyped = 0;
    mistakes = 0;

    currentIndex = 0;

    gameStarted = false;
    gameOver = false;
    passageLoading = false;

    nextScrollLine = 2;
    scrollInProgress = false;

    timerDisplay.textContent = timeLeft;

    progressBar.style.width = "100%";

    wpmDisplay.textContent = "0";
    accuracyDisplay.textContent = "100%";
    mistakesDisplay.textContent = "0";

    recoveryProgress = recoverySteps;

    gsap.set(pacman, {
        x: 0,
        y: 0
    });

    gsap.set(pacmanFace, {
        fill: normalColor
    });

    gsap.set(pacman.querySelector("svg"), {
        y: 0,
        rotation: 0
    });

    gsap.set(pacmanMouth, {
        attr: {
            points: "50,50 100,25 100,75"
        }
    });

    gameScreen.classList.remove("hidden");
    resultScreen.classList.add("hidden");

    window.scrollTo(0, 0);

    await loadSentence();

}


// 17. EVENT LISTENERS

restartButton.addEventListener("click", resetGame);

difficultySelect.addEventListener("change", resetGame);

durationSelect.addEventListener("change", resetGame);


// RETEST

retestButton.addEventListener("click", async () => {

    const selectedDuration = Number(retestDuration.value);

    if (![15, 30, 60, 120].includes(selectedDuration)) {
        return;
    }

    durationSelect.value = String(selectedDuration);

    await resetGame();

});


// BACK TO HOME

homeButton.addEventListener("click", () => {

    window.location.href = "/";

});


// TYPING AREA CLICK

typingArea.addEventListener("click", () => {

    if (!passageLoading && !gameOver) {
        typingInput.focus();
    }

});


// 18. INITIALIZE

resetGame();
