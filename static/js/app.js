/* ==========================================================
   TYPEMASTER PRO — COMPLETE GAME ENGINE
   Normal Typing + Developer Code Mode
========================================================== */


/* ==========================================================
   1. DOM ELEMENTS
========================================================== */

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

const languageSelect = document.getElementById("languageSelect");
const codeEditor = document.getElementById("codeEditor");

const codeDisplay = document.getElementById("codeDisplay");
const codeLineNumbers = document.getElementById("codeLineNumbers");
const codeLanguageLabel = document.getElementById("codeLanguageLabel");
const codeProgress = document.getElementById("codeProgress");

const targetCodeScroll = document.getElementById("targetCodeScroll");
const typedCodeScroll = document.getElementById("typedCodeScroll");

const typedCodeDisplay = document.getElementById("typedCodeDisplay");
const typedCodeLineNumbers = document.getElementById("typedCodeLineNumbers");

const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const resultWpm = document.getElementById("resultWpm");
const resultAccuracy = document.getElementById("resultAccuracy");
const resultCorrect = document.getElementById("resultCorrect");
const resultMistakes = document.getElementById("resultMistakes");
const certificateIcon = document.getElementById("certificateIcon");
const certificateRank = document.getElementById("certificateRank");
const certificateMessage = document.getElementById("certificateMessage");

const retestDuration = document.getElementById("retestDuration");
const retestButton = document.getElementById("retestButton");
const homeButton = document.getElementById("homeButton");


/* ==========================================================
   2. VALIDATION
========================================================== */

if (typeof gsap === "undefined") {
    throw new Error("GSAP failed to load!");
}

const requiredElements = [
    textDisplay,
    typingInput,
    typingArea,
    pacman,
    pacmanFace,
    pacmanMouth,
    timerDisplay,
    progressBar,
    wpmDisplay,
    accuracyDisplay,
    mistakesDisplay,
    difficultySelect,
    durationSelect,
    restartButton,
    gameScreen,
    resultScreen,
    resultWpm,
    resultAccuracy,
    resultCorrect,
    resultMistakes,
    retestDuration,
    retestButton,
    homeButton,
    languageSelect,
    codeEditor,
    codeDisplay,
    codeLineNumbers,
    certificateIcon,
    certificateRank,
    certificateMessage,
    codeLanguageLabel,
    codeProgress,
    targetCodeScroll,
    typedCodeScroll,
    typedCodeDisplay,
    typedCodeLineNumbers
    
];

if (requiredElements.some(element => !element)) {
    throw new Error("Required HTML elements are missing!");
}


/* ==========================================================
   3. GAME VARIABLES
========================================================== */

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

let nextScrollLine = 2;
let scrollInProgress = false;

// Code Mode state
let typedCodeCharacters = [];
let codeSyntaxTokens = [];
let codeErrorLocked = false;


/* ==========================================================
   4. CODE EDITOR STYLES
========================================================== */

const codeStyle = document.createElement("style");

codeStyle.textContent = `
    .code-char {
        position: relative;
        white-space: pre;
    }

    .code-char.code-current {
        background: rgba(250, 204, 21, 0.20);
        border-bottom: 2px solid #facc15;
        border-radius: 2px;
    }

    .code-char.code-correct {
        color: #34d399 !important;
    }

    .code-char.code-wrong {
        color: #f87171 !important;
        background: rgba(239, 68, 68, 0.12);
    }

    .typed-code-char {
        white-space: pre;
    }

    .typed-code-char.correct {
        color: #34d399;
    }

    .typed-code-char.wrong {
        color: #f87171;
        background: rgba(239, 68, 68, 0.12);
    }

    .typed-code-cursor {
        display: inline-block;
        width: 2px;
        height: 1.2em;
        background: #facc15;
        vertical-align: text-bottom;
        margin-left: -1px;
        animation: codeCursorBlink 1s step-end infinite;
    }

    @keyframes codeCursorBlink {
        50% { opacity: 0; }
    }
`;

document.head.appendChild(codeStyle);


/* ==========================================================
   5. MODE HELPERS
========================================================== */

function isCodeMode() {
    return difficultySelect.value === "code";
}

function getSelectedLanguage() {
    return languageSelect.value || "python";
}

function updateModeVisibility() {

    const codeMode = isCodeMode();

    languageSelect.classList.toggle("hidden", !codeMode);

    textDisplay.classList.toggle("hidden", codeMode);
    pacman.classList.toggle("hidden", codeMode);

    codeEditor.classList.toggle("hidden", !codeMode);

    if (codeMode) {
        codeLanguageLabel.textContent =
            languageSelect.options[languageSelect.selectedIndex].text;
    }
}


/* ==========================================================
   6. PACMAN ANIMATIONS
========================================================== */

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


function errorAnimation() {

    recoveryProgress = 0;

    gsap.to(pacmanFace, {
        fill: errorColor,
        duration: 0.12
    });

    const svg = pacman.querySelector("svg");

    gsap.killTweensOf(svg);

    gsap.fromTo(
        svg,
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


/* ==========================================================
   7. DJANGO PASSAGE API
========================================================== */

async function getRandomSentence() {

    const difficulty = difficultySelect.value;

    const params = new URLSearchParams({
        difficulty: difficulty
    });

    if (difficulty === "code") {
        params.set("language", getSelectedLanguage());
    }

    const response = await fetch(
        `/api/generate/?${params.toString()}`,
        {
            credentials: "same-origin"
        }
    );

    if (!response.ok) {
        throw new Error("Passage API failed!");
    }

    const data = await response.json();

    if (!data.success || typeof data.text !== "string" || !data.text.length) {
        throw new Error(data.message || "Invalid passage received!");
    }

    return data.text;
}


/* ==========================================================
   8. SYNTAX HIGHLIGHTING
========================================================== */

const syntaxKeywords = new Set([
    "abstract", "as", "async", "await", "break", "case",
    "catch", "class", "const", "continue", "def", "default",
    "delete", "do", "else", "enum", "export", "extends",
    "false", "final", "finally", "for", "foreach", "from",
    "func", "function", "if", "implements", "import", "in",
    "interface", "let", "loop", "namespace", "new", "null",
    "package", "pass", "private", "protected", "public",
    "raise", "return", "self", "static", "struct", "super",
    "switch", "this", "throw", "throws", "true", "try",
    "type", "var", "void", "while", "with", "yield",
    "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT",
    "INNER", "GROUP", "ORDER", "BY", "INSERT", "UPDATE",
    "DELETE", "CREATE", "TABLE", "AND", "OR", "NOT",
    "AS", "ON", "LIMIT"
]);


function getCodeTokens(code) {

    const tokens = [];

    const pattern =
        /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[+\-*/%=!<>|&^~?:]+/g;

    let match;

    while ((match = pattern.exec(code)) !== null) {

        const value = match[0];

        let type = "plain";

        if (
            value.startsWith("//") ||
            value.startsWith("#") ||
            value.startsWith("/*")
        ) {
            type = "comment";
        } else if (
            value.startsWith('"') ||
            value.startsWith("'") ||
            value.startsWith("`")
        ) {
            type = "string";
        } else if (/^\d/.test(value)) {
            type = "number";
        } else if (syntaxKeywords.has(value)) {
            type = "keyword";
        } else if (/^[+\-*/%=!<>|&^~?:]+$/.test(value)) {
            type = "operator";
        }

        tokens.push({
            start: match.index,
            end: match.index + value.length,
            type: type
        });
    }

    return tokens;
}


function getSyntaxClass(type) {

    const classes = {
        plain: "text-neutral-300",
        keyword: "text-purple-400",
        string: "text-green-400",
        number: "text-orange-300",
        comment: "text-neutral-500 italic",
        operator: "text-pink-400"
    };

    return classes[type] || classes.plain;
}


function getTokenTypeAt(index) {

    const token = codeSyntaxTokens.find(item =>
        index >= item.start && index < item.end
    );

    return token ? token.type : "plain";
}


/* ==========================================================
   9. CODE LINE NUMBERS
========================================================== */

function renderLineNumbers(container, lineCount) {
        container.innerHTML = "";

    for (let line = 1; line <= lineCount; line++) {

        const number = document.createElement("div");

        number.textContent = line;

        container.appendChild(number);
    }
}


/* ==========================================================
   10. TARGET CODE RENDERER
========================================================== */

function renderCodeEditor() {

    codeDisplay.innerHTML = "";
    codeLineNumbers.innerHTML = "";

    codeSyntaxTokens = getCodeTokens(currentSentence);

    const fragment = document.createDocumentFragment();

    for (let index = 0; index < currentSentence.length; index++) {

        const character = currentSentence[index];

        const span = document.createElement("span");

        span.dataset.index = index;

        span.className =
            `code-char ${getSyntaxClass(getTokenTypeAt(index))}`;

        span.textContent = character;

        fragment.appendChild(span);
    }

    codeDisplay.appendChild(fragment);

    const lineCount = currentSentence.split("\n").length;

    renderLineNumbers(codeLineNumbers, lineCount);

    codeProgress.textContent =
        `0 / ${currentSentence.length} characters`;

    typedCodeCharacters = [];

    renderTypedCode();
    updateCodeCursor();
}


/* ==========================================================
   11. LIVE USER CODE RENDERER
========================================================== */

function renderTypedCode() {

    typedCodeDisplay.innerHTML = "";

    const fragment = document.createDocumentFragment();

    typedCodeCharacters.forEach(item => {

        const span = document.createElement("span");

        span.className =
            `typed-code-char ${item.correct ? "correct" : "wrong"}`;

        span.textContent = item.character;

        fragment.appendChild(span);
    });

    const cursor = document.createElement("span");

    cursor.className = "typed-code-cursor";

    cursor.setAttribute("aria-hidden", "true");

    fragment.appendChild(cursor);

    typedCodeDisplay.appendChild(fragment);

    const typedText = typedCodeCharacters
        .map(item => item.character)
        .join("");

    const lineCount = Math.max(1, typedText.split("\n").length);

    renderLineNumbers(typedCodeLineNumbers, lineCount);

    scrollTypedCodeToCursor();
}


function scrollTypedCodeToCursor() {

    const cursor = typedCodeDisplay.querySelector(".typed-code-cursor");

    if (!cursor) return;

    const cursorRect = cursor.getBoundingClientRect();
    const containerRect = typedCodeScroll.getBoundingClientRect();

    if (cursorRect.bottom > containerRect.bottom - 30) {
        typedCodeScroll.scrollTop += 28;
    }

    if (cursorRect.right > containerRect.right - 30) {
        typedCodeScroll.scrollLeft += 30;
    }
}


/* ==========================================================
   12. TARGET CURSOR AND PROGRESS
========================================================== */

function updateCodeCursor() {

    const characters = codeDisplay.children;

    Array.from(characters).forEach(character => {
        character.classList.remove("code-current");
    });

    const currentCharacter = characters[currentIndex];

    if (currentCharacter) {

        currentCharacter.classList.add("code-current");

        currentCharacter.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "smooth"
        });
    }
}


function updateCodeProgress() {

    codeProgress.textContent =
        `${currentIndex} / ${currentSentence.length} characters`;

    updateCodeCursor();
}


/* ==========================================================
   13. LOAD PASSAGE
========================================================== */

async function loadSentence() {

    const requestId = ++passageRequestId;

    passageLoading = true;
    typingInput.disabled = true;

    updateModeVisibility();

    if (isCodeMode()) {
        codeDisplay.textContent = "Generating code...";
        typedCodeDisplay.textContent = "Preparing editor...";
    } else {
        textDisplay.textContent = "Generating new passage...";
    }

    gsap.killTweensOf(textDisplay);

    textDisplay.scrollTop = 0;

    targetCodeScroll.scrollTop = 0;
    targetCodeScroll.scrollLeft = 0;

    typedCodeScroll.scrollTop = 0;
    typedCodeScroll.scrollLeft = 0;

    scrollInProgress = false;
    nextScrollLine = 2;

    try {

        const passage = await getRandomSentence();

        if (requestId !== passageRequestId) return;

        currentSentence = passage;
        currentIndex = 0;

        if (isCodeMode()) {

            renderCodeEditor();

            codeLanguageLabel.textContent =
                languageSelect.options[languageSelect.selectedIndex].text;

        } else {

            textDisplay.innerHTML = "";

            currentSentence.split("").forEach(character => {

                const span = document.createElement("span");

                span.textContent = character;
                span.className = "text-neutral-300";

                textDisplay.appendChild(span);
            });
        }

        passageLoading = false;
        typingInput.disabled = false;

        if (!isCodeMode()) {

            requestAnimationFrame(() => {
                updatePacman();
            });
        }

        typingInput.focus();

    } catch (error) {

        if (requestId !== passageRequestId) return;

        console.error("Passage loading error:", error);

        if (isCodeMode()) {

            codeDisplay.textContent =
                "Unable to generate code. Please restart.";

        } else {

            textDisplay.textContent =
                "Unable to generate passage. Please restart.";
        }

        passageLoading = true;
        typingInput.disabled = true;
    }
}


/* ==========================================================
   14. PACMAN POSITION
========================================================== */

function updatePacman() {

    if (isCodeMode() || !pacman || !textDisplay.children[currentIndex]) {
        return;
    }

    const character = textDisplay.children[currentIndex];

    // Use Pac-Man's actual positioning parent. This keeps the calculation
    // correct even if the HTML nesting or positioned container changes.
    const positionParent = pacman.offsetParent || typingArea;

    const parentRect = positionParent.getBoundingClientRect();
    const charRect = character.getBoundingClientRect();

    const pacmanWidth = pacman.offsetWidth || 42;
    const pacmanHeight = pacman.offsetHeight || 42;

    // Pac-Man's CSS left/top are its starting position. GSAP moves it
    // from that point so its mouth sits just before the current character.
    const x =
        charRect.left -
        parentRect.left -
        pacmanWidth -
        pacman.offsetLeft;

    // Center Pac-Man vertically on the current character's line.
    const y =
        charRect.top +
        charRect.height / 2 -
        parentRect.top -
        pacmanHeight / 2 -
        pacman.offsetTop;

    gsap.to(pacman, {
        x,
        y,
        duration: 0.16,
        ease: "power2.out",
        overwrite: "auto"
    });
}



/* ==========================================================
   15. NORMAL MODE SCROLLING
========================================================== */

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


/* ==========================================================
   16. TIMER
========================================================== */

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


/* ==========================================================
   17. CODE MODE CHARACTER DISPLAY
========================================================== */

function addTypedCodeCharacter(character, correct) {

    typedCodeCharacters.push({
        character: character,
        correct: correct
    });

    renderTypedCode();
}


function markTargetCharacter(correct) {

    const characterElement = codeDisplay.children[currentIndex];

    if (!characterElement) return;

    characterElement.classList.remove(
        "code-correct",
        "code-wrong",
        "code-current"
    );

    characterElement.classList.add(
        correct ? "code-correct" : "code-wrong"
    );
}


/* ==========================================================
   18. CHARACTER TYPING ENGINE
========================================================== */

function typeCharacter(typedCharacter) {

    if (gameOver || passageLoading || typingInput.disabled) {
        return;
    }

    // Stop typing until the wrong character is removed.
    if (isCodeMode() && codeErrorLocked) {
        return;
    }

    const codeMode = isCodeMode();

    const characterElement = codeMode
        ? codeDisplay.children[currentIndex]
        : textDisplay.children[currentIndex];

    if (!characterElement) return;

    startTimer();

    const expectedCharacter = currentSentence[currentIndex];

    totalTyped++;

    const isCorrect = typedCharacter === expectedCharacter;

    if (codeMode) {

        addTypedCodeCharacter(typedCharacter, isCorrect);

        markTargetCharacter(isCorrect);
    }

    if (isCorrect) {

        correctTyped++;

        if (codeMode) {

            currentIndex++;

            updateCodeProgress();

        } else {

            characterElement.style.visibility = "hidden";

            characterElement.classList.remove("text-red-500");

            recoverPacman();
            eatAnimation();

            currentIndex++;
        }

        updateStats();

        if (currentIndex >= currentSentence.length) {

            loadSentence();

        } else if (!codeMode) {

            scrollTypingWindow();
        }

    } else {

        mistakes++;

        if (codeMode) {

            // Lock typing until the wrong character is removed.
            codeErrorLocked = true;

            // Keep the cursor on the expected character.
            updateCodeCursor();

        } else {

            characterElement.classList.add("text-red-500");

            errorAnimation();
        }

        updateStats();
    }
}

/* ==========================================================
   19. TYPING INPUT HANDLER
========================================================== */

typingInput.addEventListener("keydown", function(event) {

    if (gameOver || passageLoading) return;

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // Backspace: Remove incorrect character and unlock typing.
    if (event.key === "Backspace") {

        event.preventDefault();

        if (isCodeMode() && codeErrorLocked) {

            // Remove the last incorrect character
            typedCodeCharacters.pop();

            // Unlock typing
            codeErrorLocked = false;

            // Reset target character styling
            const characterElement = codeDisplay.children[currentIndex];

            if (characterElement) {

                characterElement.classList.remove(
                    "code-wrong",
                    "code-correct",
                    "code-current"
                );
            }

            // Restore live editor and cursor
            renderTypedCode();
            updateCodeCursor();
        }

        return;
    }

    // Tab inserts four spaces in Code Mode.
    if (isCodeMode() && event.key === "Tab") {

        event.preventDefault();

        for (let i = 0; i < 4; i++) {

            if (gameOver || passageLoading || codeErrorLocked) break;

            typeCharacter(" ");
        }

        return;
    }

    // Enter inserts a newline in Code Mode.
    if (isCodeMode() && event.key === "Enter") {

        event.preventDefault();

        typeCharacter("\n");

        return;
    }

    // Ignore non-character keys.
    if (event.key.length !== 1) return;

    event.preventDefault();

    typeCharacter(event.key);
});


/* ==========================================================
   20. LIVE STATISTICS
========================================================== */

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


/* ==========================================================
   21. CSRF TOKEN
========================================================== */

function getCSRFToken() {

    const cookie = document.cookie
        .split("; ")
        .find(row => row.startsWith("csrftoken="));

    return cookie
        ? decodeURIComponent(cookie.split("=")[1])
        : "";
}


/* ==========================================================
   22. SAVE RESULT TO DJANGO
========================================================== */

async function saveTestResult(wpm, accuracy, correct, mistakeCount) {

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
                mistakes: mistakeCount,
                duration: totalTime,
                difficulty: difficultySelect.value,
                language: isCodeMode() ? getSelectedLanguage() : ""

            })
        });

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


/* ==========================================================
   23. RESULT SCREEN
========================================================== */

async function endGame() {

    if (gameOver) return;

    clearInterval(timerInterval);

    gameOver = true;

    typingInput.disabled = true;
    typingInput.blur();

    timerDisplay.textContent = "0";
    progressBar.style.width = "0%";

    const elapsedMinutes = totalTime / 60;

    const finalWpm = elapsedMinutes > 0
        ? Math.round((correctTyped / 5) / elapsedMinutes)
        : 0;

    const finalAccuracy = totalTyped > 0
        ? Math.round((correctTyped / totalTyped) * 100)
        : 100;

    await saveTestResult(
        finalWpm,
        finalAccuracy,
        correctTyped,
        mistakes
    );

    resultWpm.textContent = finalWpm;
    resultAccuracy.textContent = finalAccuracy + "%";
    resultCorrect.textContent = correctTyped;
    resultMistakes.textContent = mistakes;

    // CERTIFICATION SYSTEM
let certificate = {
    rank: "None",
    icon: "—",
    message: "Keep practising to earn your first certificate!"
};

if (finalWpm >= 70 && finalAccuracy >= 98) {

    certificate = {
        rank: "Gold",
        icon: "🥇",
        message: "Outstanding! Elite typing performance."
    };

} else if (finalWpm >= 50 && finalAccuracy >= 95) {

    certificate = {
        rank: "Silver",
        icon: "🥈",
        message: "Excellent! Silver achievement unlocked."
    };

} else if (finalWpm >= 35 && finalAccuracy >= 90) {

    certificate = {
        rank: "Bronze",
        icon: "🥉",
        message: "Great start! Bronze achievement unlocked."
    };
}

// CERTIFICATE BUTTON
const viewCertificatesBtn = document.getElementById("viewCertificatesBtn");

if (viewCertificatesBtn) {
    const hasCertificate = ["Bronze", "Silver", "Gold"].includes(certificate.rank);

    viewCertificatesBtn.classList.toggle("hidden", !hasCertificate);
}

certificateIcon.textContent = certificate.icon;
certificateRank.textContent = certificate.rank;
certificateMessage.textContent = certificate.message;

    retestDuration.value = String(totalTime);

    gameScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* ==========================================================
   24. RESET GAME
========================================================== */

async function resetGame() {

    clearInterval(timerInterval);

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

    typedCodeCharacters = [];

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

    updateModeVisibility();

    textDisplay.scrollTop = 0;

    targetCodeScroll.scrollTop = 0;
    targetCodeScroll.scrollLeft = 0;

    typedCodeScroll.scrollTop = 0;
    typedCodeScroll.scrollLeft = 0;

    codeDisplay.scrollTop = 0;
    codeDisplay.scrollLeft = 0;

    gameScreen.classList.remove("hidden");
    resultScreen.classList.add("hidden");

    window.scrollTo(0, 0);

    await loadSentence();
}


/* ==========================================================
   25. EVENT LISTENERS
========================================================== */

restartButton.addEventListener("click", resetGame);

difficultySelect.addEventListener("change", resetGame);

durationSelect.addEventListener("change", resetGame);

languageSelect.addEventListener("change", resetGame);


// Retest

retestButton.addEventListener("click", async () => {

    const selectedDuration = Number(retestDuration.value);

    if (![15, 30, 60, 120].includes(selectedDuration)) {
        return;
    }

    durationSelect.value = String(selectedDuration);

    await resetGame();
});


// Back to home

homeButton.addEventListener("click", () => {

    window.location.href = "/";
});


// Typing area click

typingArea.addEventListener("click", () => {

    if (!passageLoading && !gameOver) {
        typingInput.focus();
    }
});


/* ==========================================================
   26. INITIALIZE
========================================================== */

updateModeVisibility();

resetGame();