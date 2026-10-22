
const quizData = await (await fetch("./data_quiz_1.json")).json();

const SCORE_STORAGE_KEY = "netlab-quiz-1-scores";

const $ = id => document.getElementById(id);

let mode = "test";
let sequence = [];
let index = 0;
let answers = {};
let checked = {};
let startedAt = 0;
let activeQuestion = null;
let resultPercent = 0;
let correctCount = 0;
let autoNextTimer = null;

const shuffle = array => {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
};

const clean = value =>
    String(value ?? "").trim().replace(/\s+/g, " ");

const normalize = value =>
    clean(value).toLocaleLowerCase("pl").replace(/[.,;:!?]/g, "");

$("total-count").textContent = quizData.questions.length;

let seconds = 0;

setInterval(() => {
    seconds++;

    $("clock").textContent =
        String(Math.floor(seconds / 60)).padStart(2, "0") +
        ":" +
        String(seconds % 60).padStart(2, "0");
}, 1000);

document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => start(button.dataset.mode));
});

$("exit").addEventListener("click", () => {
    clearTimeout(autoNextTimer);
    show("home");
});

$("check").addEventListener("click", checkAnswer);
$("next").addEventListener("click", nextQuestion);

$("again").addEventListener("click", () => {
    clearTimeout(autoNextTimer);
    show("home");
});

$("refresh-board").addEventListener("click", loadBoard);
$("publish").addEventListener("click", publishScore);

// Ukrywanie lewego panelu postępu w trybie random.
function updateRandomLayout() {
    const progressPanel = document.querySelector(
        ".progress-panel, #progress-panel, .test-progress-panel, [data-progress-panel]"
    );

    if (progressPanel) {
        progressPanel.classList.toggle("hidden", mode === "random");
    }
}

function show(id) {
    ["home", "quiz", "results"].forEach(element => {
        $(element).classList.toggle("hidden", element !== id);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function start(nextMode) {
    clearTimeout(autoNextTimer);

    mode = nextMode;

    const all = shuffle(quizData.questions);

    if (mode === "random") {
        sequence = all;
    } else if (mode === "test") {
        sequence = all.slice(0, 20);
    } else {
        sequence = [...quizData.questions];
    }

    index = 0;
    answers = {};
    checked = {};
    startedAt = Date.now();

    show("quiz");
    updateRandomLayout();

    $("session-label").textContent =
        mode === "random"
            ? "QUICK PRACTICE"
            : mode === "test"
                ? "EXAM SIMULATION"
                : "STUDY MODE";

    renderQuestion();
}

function renderQuestion() {
    activeQuestion = sequence[index];

    const q = activeQuestion;
    const saved = answers[q.id];

    updateRandomLayout();

    $("counter").textContent =
        `QUESTION ${String(index + 1).padStart(2, "0")} / ${sequence.length}`;

    $("progress").style.width =
        `${((index + 1) / sequence.length) * 100}%`;

    $("question-id").textContent = `QUESTION #${q.id}`;
    $("question-title").textContent = q.question;

    $("question-category").textContent =
        q.type === "open"
            ? "OPEN RESPONSE"
            : q.type === "matching"
                ? "MATCHING"
                : q.question.toLowerCase().includes("ipv6")
                    ? "IPV6"
                    : "ADDRESSING";

    $("question-hint").textContent =
        q.type === "multi"
            ? "Wybierz wszystkie poprawne odpowiedzi. Liczba poprawnych odpowiedzi jest taka jak w materiale źródłowym."
            : q.type === "matching"
                ? "Dopasuj elementy zgodnie z ilustracją."
                : q.type === "open"
                    ? "Wpisz odpowiedź w polu poniżej."
                    : "Wybierz jedną odpowiedź.";

    const imageWrap = $("question-image-wrap");
    const image = $("question-image");

    if (q.image) {
        imageWrap.classList.remove("hidden");
        image.src = q.image;
        image.onerror = () => imageWrap.classList.add("hidden");
    } else {
        imageWrap.classList.add("hidden");
        image.removeAttribute("src");
    }

    const area = $("answer-area");
    area.innerHTML = "";

    if (q.type === "open") {
        const input = document.createElement("textarea");

        input.className = "open-answer";
        input.placeholder = "Wpisz odpowiedź…";
        input.value = saved?.text || "";

        input.addEventListener("input", () => {
            answers[q.id] = { text: input.value };
        });

        area.append(input);

    } else if (q.type === "matching") {
        const pairs = q.matching?.pairs || [];

        const choices = q.matching?.choices?.length
            ? q.matching.choices
            : [...new Set(pairs.map(pair => pair.right))];

        if (!pairs.length) {
            const note = document.createElement("div");

            note.className = "board-empty";
            note.textContent =
                "Brakuje danych tekstowych do utworzenia dopasowania.";

            area.append(note);
        }

        pairs.forEach(pair => {
            const row = document.createElement("div");
            row.className = "matching-row";

            const left = document.createElement("div");
            left.textContent = pair.left;

            const select = document.createElement("select");

            select.innerHTML =
                '<option value="">Wybierz odpowiedź…</option>' +
                choices.map(choice =>
                    `<option value="${escapeHtml(choice)}">${escapeHtml(choice)}</option>`
                ).join("");

            select.value = saved?.matches?.[pair.left] || "";

            select.addEventListener("change", () => {
                answers[q.id] ??= { matches: {} };
                answers[q.id].matches[pair.left] = select.value;
            });

            row.append(left, select);
            area.append(row);
        });

    } else {
        const options = shuffle(q.options || []);

        options.forEach((option, i) => {
            const label = document.createElement("label");
            label.className = "answer-option";

            const input = document.createElement("input");

            input.type = q.type === "multi" ? "checkbox" : "radio";
            input.name = "answer";
            input.value = option;

            input.checked = q.type === "multi"
                ? (saved?.selected || []).includes(option)
                : saved?.selected === option;

            input.addEventListener("change", () => {
                if (q.type === "multi") {
                    let current = answers[q.id]?.selected || [];

                    current = input.checked
                        ? [...current, option]
                        : current.filter(value => value !== option);

                    answers[q.id] = { selected: current };

                    $("select-note").textContent =
                        `Zaznaczono ${current.length} / ${q.correctAnswers.length}`;
                } else {
                    answers[q.id] = { selected: option };
                }
            });

            const letter = document.createElement("span");
            letter.className = "option-letter";
            letter.textContent = String.fromCharCode(65 + i);

            const text = document.createElement("span");
            text.textContent = option;

            label.append(input, letter, text);
            area.append(label);
        });
    }

    $("select-note").textContent =
        q.type === "multi"
            ? `Wybierz ${q.correctAnswers.length} odpowiedzi`
            : "";

    $("feedback").className = "feedback hidden";
    $("feedback").textContent = "";

    $("check").classList.toggle("hidden", checked[q.id] !== undefined);
    $("next").classList.toggle("hidden", checked[q.id] === undefined);

    $("question-panel")?.classList.remove("reviewed");

    if (checked[q.id] !== undefined) {
        showReview(q);
    }

    renderNav();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function isCorrect(q) {
    const answer = answers[q.id];

    if (q.type === "open") {
        return (q.acceptedAnswers || q.correctAnswers || [])
            .some(value => normalize(value) === normalize(answer?.text));
    }

    if (q.type === "matching") {
        const correct = q.matching?.correct || [];

        return correct.length > 0 &&
            correct.every(([left, right]) =>
                answer?.matches?.[left] === right
            );
    }

    const chosen = q.type === "multi"
        ? answer?.selected || []
        : answer?.selected
            ? [answer.selected]
            : [];

    return chosen.length === q.correctAnswers.length &&
        chosen.every(value =>
            q.correctAnswers.some(correct =>
                normalize(correct) === normalize(value)
            )
        );
}

function checkAnswer() {
    const q = activeQuestion;
    const answer = answers[q.id];

    if (checked[q.id] !== undefined) {
        return;
    }

    if (
        q.type === "multi" &&
        (answer?.selected || []).length !== q.correctAnswers.length
    ) {
        $("feedback").className = "feedback bad";
        $("feedback").textContent =
            `Zaznacz dokładnie ${q.correctAnswers.length} odpowiedzi.`;
        return;
    }

    if (q.type === "matching" && !q.matching?.pairs?.length) {
        $("feedback").className = "feedback bad";
        $("feedback").textContent =
            "Brakuje danych tekstowych do sprawdzenia tego dopasowania.";
        return;
    }

    if (q.type === "open" && !clean(answer?.text)) {
        $("feedback").className = "feedback bad";
        $("feedback").textContent =
            "Wpisz odpowiedź przed sprawdzeniem.";
        return;
    }

    checked[q.id] = isCorrect(q);

    showReview(q);

    $("check").classList.add("hidden");
    $("next").classList.remove("hidden");

    $("progress").style.width =
        `${((index + 1) / sequence.length) * 100}%`;

    renderNav();

    if (mode === "random") {
        $("next").classList.add("hidden");

        clearTimeout(autoNextTimer);

        autoNextTimer = setTimeout(() => {
            const remaining = sequence.filter(
                question => checked[question.id] === undefined
            );

            if (remaining.length === 0) {
                sequence = shuffle(quizData.questions);
                answers = {};
                checked = {};
                index = 0;
            } else {
                const next = remaining[
                    Math.floor(Math.random() * remaining.length)
                ];

                index = sequence.indexOf(next);
            }

            renderQuestion();
        }, 3000);
    }
}

function showReview(q) {
    const correct = checked[q.id];
    const feedback = $("feedback");

    feedback.className = "feedback " + (correct ? "good" : "bad");

    if (correct) {
        feedback.textContent = "✓ Poprawna odpowiedź!";
    } else {
        let correctText = "";

        if (q.type === "matching") {
            correctText = (q.matching?.correct || [])
                .map(([left, right]) => `${left} → ${right}`)
                .join("; ");
        } else if (q.type === "open") {
            correctText =
                (q.acceptedAnswers || q.correctAnswers || []).join(", ");
        } else {
            correctText = (q.correctAnswers || []).join(", ");
        }

        feedback.textContent =
            `✗ Niepoprawna odpowiedź. Poprawna odpowiedź: ${correctText}`;
    }

    document.querySelectorAll(".answer-option").forEach(element => {
        const text =
            element.querySelector("span:last-child")?.textContent;

        const input = element.querySelector("input");

        if (
            q.correctAnswers?.some(
                value => normalize(value) === normalize(text)
            )
        ) {
            element.classList.add("correct");
        } else {
            element.classList.remove("correct");
        }

        if (!correct && input?.checked) {
            element.classList.add("incorrect");
        } else {
            element.classList.remove("incorrect");
        }
    });

    $("answer-area")
        .querySelectorAll("input, textarea, select")
        .forEach(element => {
            element.disabled = true;
        });
}

function nextQuestion() {
    clearTimeout(autoNextTimer);

    if (mode === "random") {
        const remaining = sequence.filter(
            question =>
                question.id !== activeQuestion.id &&
                checked[question.id] === undefined
        );

        if (remaining.length === 0) {
            sequence = shuffle(quizData.questions);
            answers = {};
            checked = {};
            index = 0;
        } else {
            const next = remaining[
                Math.floor(Math.random() * remaining.length)
            ];

            index = sequence.indexOf(next);
        }

        renderQuestion();
        return;
    }

    if (index < sequence.length - 1) {
        index++;
        renderQuestion();
    } else {
        finish();
    }
}

function renderNav() {
    const nav = $("question-nav");
    nav.innerHTML = "";

    sequence.forEach((q, i) => {
        const button = document.createElement("button");

        button.className =
            "nav-dot" +
            (i === index ? " current" : "") +
            (checked[q.id] !== undefined ? " done" : "");

        button.textContent = String(i + 1);
        button.title = `Pytanie ${q.id}`;

        button.addEventListener("click", () => {
            clearTimeout(autoNextTimer);
            index = i;
            renderQuestion();
        });

        nav.append(button);
    });
}

function finish() {
    clearTimeout(autoNextTimer);

    correctCount = sequence.filter(
        question => checked[question.id] === true
    ).length;

    resultPercent = Math.round(
        correctCount / sequence.length * 100
    );

    $("result-percent").textContent = resultPercent + "%";

    $("result-correct").textContent =
        `${correctCount} / ${sequence.length}`;

    const passed = mode !== "test" || resultPercent >= 70;

    $("result-status").textContent = passed
        ? (mode === "test" ? "ZALICZONY" : "GOTOWE")
        : "NIEZALICZONY";

    $("result-status").style.color =
        passed ? "var(--green)" : "var(--red)";

    $("result-symbol").classList.toggle("fail", !passed);
    $("result-symbol").textContent = passed ? "✓" : "×";

    $("result-title").textContent =
        mode === "random"
            ? "Pytanie zakończone"
            : mode === "study"
                ? "Sesja nauki zakończona"
                : passed
                    ? "Gratulacje, test zaliczony."
                    : "Tym razem poniżej progu.";

    $("result-desc").textContent =
        `Ukończono ${sequence.length} pytań. Twój wynik to ${resultPercent}%. Próg zaliczenia testu wynosi 70%.`;

    show("results");

    $("publish-status").textContent = "";
    $("nickname").value = "";

    loadBoard();
}

const profanity = [
    "kurwa", "chuj", "pizda", "jebac", "jebać",
    "pierdol", "spierdal", "suka", "cipa", "fuck",
    "shit", "bitch", "asshole", "cunt", "nigger", "nigga"
];

function safeNickname(value) {
    const name = normalize(value)
        .replace(/[^a-z0-9ąćęłńóśźż]/gi, "");

    return name.length >= 2 &&
        name.length <= 18 &&
        !profanity.some(word => name.includes(word));
}

function readScores() {
    try {
        const value = JSON.parse(
            localStorage.getItem(SCORE_STORAGE_KEY) || "[]"
        );

        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function publishScore() {
    const name = clean($("nickname").value);
    const status = $("publish-status");

    if (!safeNickname(name)) {
        status.textContent =
            "Wpisz pseudonim 2–18 znaków bez wulgaryzmów.";
        return;
    }

    const button = $("publish");
    button.disabled = true;

    try {
        const rows = readScores();

        rows.push({
            nickname: name,
            score: resultPercent,
            correct: correctCount,
            total: sequence.length,
            mode,
            createdAt: Date.now()
        });

        rows.sort((a, b) =>
            (Number(b.score) || 0) - (Number(a.score) || 0)
        );

        localStorage.setItem(
            SCORE_STORAGE_KEY,
            JSON.stringify(rows.slice(0, 25))
        );

        status.textContent =
            "Wynik zapisany w rankingu tej przeglądarki.";

        loadBoard();

    } catch (error) {
        console.error(error);

        status.textContent =
            "Nie udało się zapisać wyniku. Sprawdź ustawienia pamięci przeglądarki.";
    } finally {
        button.disabled = false;
    }
}

function loadBoard() {
    const element = $("leaderboard-list");

    const rows = readScores()
        .sort((a, b) =>
            (Number(b.score) || 0) - (Number(a.score) || 0)
        )
        .slice(0, 25);

    if (!rows.length) {
        element.innerHTML =
            '<div class="board-empty">Brak zapisanych wyników. Bądź pierwszy!</div>';
        return;
    }

    element.innerHTML = rows.map((row, i) =>
        `<div class="board-row">
            <span class="board-rank">${String(i + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(row.nickname || "Anonim")}</strong>
            <span class="board-score">${Number(row.score) || 0}%</span>
            <span class="board-date">${Number(row.correct) || 0}/${Number(row.total) || 0} pkt</span>
        </div>`
    ).join("");
}
