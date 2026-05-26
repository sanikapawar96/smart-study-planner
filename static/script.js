function signup() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    if (!username || !password) {
        alert("Enter username & password");
        return;
    }

    fetch("/signup", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            alert("Signup successful! Please login.");
            window.location.href = "/";
        } else {
            alert(data.error);
        }
    });
}

function login() {
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();

    fetch("/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            window.location.href = "/dashboard";
        } else {
            alert(data.error);
        }
    });
}

function goToSignup() {
    window.location.href = "/signup-page";
}

function goToLogin() {
    window.location.href = "/";
}

function addTask() {
    let taskInput = document.getElementById("taskInput");
    let durationInput = document.getElementById("duration");
    let priority = document.getElementById("priority").value;
    let deadline = document.getElementById("deadline").value;

    let task = taskInput.value;
    let duration = durationInput.value ? parseInt(durationInput.value) : 0;

    if (task === "") return;

    fetch("/add", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ task, duration, priority, deadline })
    })
    .then(res => {
        if (!res.ok) {
            throw new Error("Not logged in");
        }
        return res.json();
    })
    .then(() => showTasks())
    .catch(err => {
        alert("Session expired. Please login again.");
        window.location.href = "/";
});

    taskInput.value = "";
    durationInput.value = "";
}

function showTasks() {
    fetch("/tasks")
        .then(res => res.json())
        .then(data => {

            let list = document.getElementById("taskList");

            // ✅ clear only if exists
            if (list) list.innerHTML = "";

            let totalTasks = 0;
            let completedTasks = 0;
            let totalTime = 0;
            let progress = 0;

            data.forEach(item => {

                let duration = Number(item.duration) || 0;

                totalTasks++;
                totalTime += duration;
                if (item.done) completedTasks++;

                // ✅ only build UI if taskList exists
                if (list) {
                    let li = document.createElement("li");

                    li.innerHTML = `
                    <div class="task-card ${item.done ?  'done' : ''}">

                        <div class="task-header">
                            <h3 class="task-title ${item.done ? 'done-task' : ''}">
                                ${item.task}
                            </h3>
                        
                            <span class="badge">
                            ${duration > 0 ? duration + " min" : "No timer"}
                            </span>
                        </div>
                        <div class="task-meta">
                            <span class="priority ${getPriorityClass(item.priority  || 2)}">
                                ${getPriorityLabel(item.priority  || 2)}
                            </span>

                            ${item.deadline ? `<span class="deadline">📅 ${item.deadline}</span>` : ""}
                        </div>

                        <div class="task-actions">

                            ${!item.done ? `<button class="btn focus" onclick="goToFocus(${item.id})">Focus</button>` : ""}

                            ${!item.done ? `<button class="btn done" onclick="markDone(${item.id})">Done</button>` : ""}
 
                            <button class="btn delete" onclick="deleteTask(${item.id})">Delete</button>

                        </div>

                        <div class="task-status">
                            ${item.done ? "✅ Completed" : "⏳ Pending"}
                        </div>
                    </div>
                    `;

                    list.appendChild(li); // ✅ inside block
                }
            });
            if (totalTasks > 0) {
                progress = Math.round((completedTasks / totalTasks) * 100);
            }

            // ✅ update stats safely
            let totalEl = document.getElementById("totalTasks");
            let completedEl = document.getElementById("completedTasks");
            let timeEl = document.getElementById("studyTime");
            let totalTimeEl = document.getElementById("totalTime");
            let bar = document.getElementById("progressBar");
            let text = document.getElementById("progressText");

            if (totalEl) totalEl.innerText = totalTasks;
            if (completedEl) completedEl.innerText = completedTasks;
            if (timeEl) timeEl.innerText = totalTime;
            if (totalTimeEl) totalTimeEl.innerText = "Total study Time: " + totalTime + " min";
            if (bar) bar.style.width = progress + "%";
            if (text) text.innerText = progress + "% completed";
        });
}

function deleteTask(id) {
    fetch(`/delete/${id}`, { method: "DELETE" })
        .then(() => showTasks());
}

function markDone(id) {
    fetch(`/complete/${id}`, { method: "PUT" })
        .then(() => showTasks());
}

function stopTimer() {
    if (focusTimerInterval) {
        clearInterval(focusTimerInterval);
        remainingTime = 0;
    }

    let focus = document.getElementById("focusMode");
    if (focus) focus.style.display = "none";
    let box = document.querySelector(".timer-circle");
    if (box) box.classList.remove("running");
}

function goToFocus() {
    window.location.href = "/focus";
}

function loadTasksToDropdown() {
    fetch("/tasks")
        .then(res => res.json())
        .then(data => {
            let select = document.getElementById("taskSelect");
            if (!select) return;

            select.innerHTML = "";

            data.forEach(item => {
                if (!item.done) {
                    let option = document.createElement("option");
                    option.value = item.id;
                    option.textContent = item.task + " (" + item.duration + " min)";
                    select.appendChild(option);
                }
            });
        });
}
if (document.getElementById("taskSelect")) {
    loadTasksToDropdown();
}

let focusTimerInterval = null;
let remainingTime = 0;
let totalTime = 0;
let currentTaskId = null;
let alarm = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");

function startFocus() {

    let select = document.getElementById("taskSelect");
    if (!select || select.value === "") {
        alert("Select a task first");
        return;
    }

    let selectedOption = select.options[select.selectedIndex];
    let text = selectedOption.textContent;

    let minutesMatch = text.match(/\d+/);
    let minutes = minutesMatch ? parseInt(minutesMatch[0]) : 25;
    
    totalTime = minutes * 60;
    remainingTime = totalTime;
    currentTaskId = select.value;
    
    let circle = document.getElementById("progressCircle");
    if (circle) {
        circle.style.strokeDashoffset = 628;
        circle.style.stroke = "#c4d5fd";
    }
    alarm.play().then(() => {
        alarm.pause();
        alarm.currentTime = 0;
    }).catch(() => {});

    runTimer(); 
        
}

let pausedTime = 0;
let isPaused = false;

function pauseTimer() {
    if (focusTimerInterval){
        clearInterval(focusTimerInterval);
        isPaused = true;
    }
}

function resumeTimer() {
   if (remainingTime > 0) {
    runTimer();
   }
}
let quotes = [
    "Stay focused 🚀",
    "You are doing great 💪",
    "Consistency wins 🔥",
    "One step at a time 🌱",
    "Keep going"
];

setInterval(() => {
    let el = document.getElementById("motivationText");
    if (el) {
        let random = Math.floor(Math.random() * quotes.length);
        el.innerText = quotes[random];
    }
}, 10000);

function runTimer() {

    let circle = document.getElementById("progressCircle");

    if (focusTimerInterval) clearInterval(focusTimerInterval);

    focusTimerInterval = setInterval(() => {

        let min = Math.floor(remainingTime / 60);
        let sec = remainingTime % 60;

        let display = `${min}:${sec < 10 ? '0' + sec : sec}`;

        let timer = document.getElementById("focusTimer");
        if (timer) timer.innerText = display;

        // circle animation
        let progress = remainingTime / totalTime;
        let offset = 628 - (628 * progress);

        if (circle) {
            circle.style.strokeDashoffset = offset;
        }

        if (remainingTime <= 0) {
            clearInterval(focusTimerInterval);

            handleSessionComplete();
            return;

        }
        remainingTime--;

    }, 1000);
}

function handleSessionComplete() {

    try {
        alarm.currentTime = 0;
        alarm.play();
    } catch (e) {
        console.log("Sound blocked");
    }

    fetch(`/complete/${currentTaskId}`, { method: "PUT" })
        .then(() => {

            alert("🎉 Task Completed!");

            // ✅ REDIRECT AFTER ALERT
            setTimeout(() => {
                window.location.href = "/dashboard";
            }, 500);
        });
}

function getAI() {
    fetch("/recommend")
        .then(res => res.json())
        .then(data => {

            let box = document.getElementById("aiBox");
            box.innerHTML = "";

            data.forEach(item => {
                let div = document.createElement("div");
                div.className = "ai-card";
                div.innerText = item;
                div.onclick = () => {
                    window.location.href = "/tasks-page";
                };
                box.appendChild(div);
            });
        });
}

function getPriorityLabel(p) {
    if (p == 1) return "🔥 High";
    if (p == 2) return "⚡ Medium";
    if (p == 3) return "🌱 Low";
    return "";
}
function getPriorityClass(p) {
    if (p == 1) return "high";
    if (p == 2) return "medium";
    if (p == 3) return "low";
    return "";
}
function loadDashboard() {
    fetch("/dashboard-data")
        .then(res => res.json())
        .then(data => {

            // stats
            document.getElementById("totalTasks").innerText = data.total;
            document.getElementById("completedTasks").innerText = data.completed;
            document.getElementById("studyTime").innerText = data.time;

            // progress
            let progress = data.total > 0 
                ? Math.round((data.completed / data.total) * 100) 
                : 0;

            let bar = document.getElementById("progressBar");
            let text = document.getElementById("progressText");

            if (bar) bar.style.width = progress + "%";
            if (text) text.innerText = progress + "% completed";

            // 🔥 focus tasks
            let focusBox = document.getElementById("focusList");
            focusBox.innerHTML = "";

            data.focus.forEach(t => {
                let div = document.createElement("div");
                div.className = "task-card";
                div.innerHTML = `
                    <b>📘 ${t.task}</b><br>
                    ${getPriorityLabel(t.priority)}
                    ${t.deadline ? "📅 " + t.deadline : ""}
                `;
                focusBox.appendChild(div);
            });

            // ⚠️ overdue
            let overBox = document.getElementById("overdueList");
            overBox.innerHTML = "";

            data.overdue.forEach(t => {
                let div = document.createElement("div");
                div.className = "task-card";
                div.innerHTML = `
                    ❗ ${t.task} (Missed ${t.deadline})
                `;
                overBox.appendChild(div);
            });

        });
}

function getSmartPlan() {
    fetch("/smart-plan")
        .then(res => res.json())
        .then(data => {

            let box = document.getElementById("planBox");
            box.innerHTML = "";

            data.forEach(item => {
                let div = document.createElement("div");
                div.className = "plan-card";
                div.innerText = item;
                box.appendChild(div);
            });

        });
}
function getSmartPlan() {
    fetch("/smart-plan")
        .then(res => res.json())
        .then(data => {

            let box = document.getElementById("planBox");
            box.innerHTML = "";

            let planTasks = [];

            data.forEach((item, index) => {

                let div = document.createElement("div");
                div.className = "plan-card";
                if (index === 0) {
                    div.classList.add("today-plan");
                }
                div.innerText = item;

                // extract tasks (basic parsing)
                let parts = item.split("→")[1] || item;
                parts.split(",").forEach(p => {
                    let name = p.trim();
                    if (name) {
                        planTasks.push({
                            task: name,
                            duration: 25
                        });
                    }
                });

                box.appendChild(div);
            });

            // 🔥 ADD BUTTON
            let btn = document.createElement("button");
            btn.innerText = "✅ Add Plan to Tasks";

            btn.onclick = () => {
                fetch("/apply-plan", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ tasks: planTasks })
                })
                .then(res => res.json())
                .then(() => {
                    alert("Plan added!");
                });
            };

            box.appendChild(btn);

        });
}
/*function setTheme(theme) {
    // remove everything first
    document.body.classList.remove("dark", "nature", "focus-theme");

    if (theme) {
        document.body.classList.add(theme);
        localStorage.setItem("theme", theme);
    } else {
        localStorage.removeItem("theme");
    }
}*/
function setTheme(theme) {
    document.body.className = theme;
    localStorage.setItem("theme", theme);
}

window.onload = () => {
    const saved = localStorage.getItem("theme");
    if (saved) document.body.className = saved;
};
window.onload = function () {
    let saved = localStorage.getItem("theme");

    // 🔥 ALWAYS reset theme classes first
    document.body.classList.remove("dark", "nature", "focus-theme");

    // ✅ apply saved theme
    if (saved) {
        document.body.classList.add(saved);
    }

    // ✅ apply focus-theme ONLY for nature + focus page
    if (window.location.pathname === "/focus" ) {
        applyFocusTheme();
    }
};
function toggleThemeMenu() {
    const menu = document.getElementById("themeOptions");
    menu.style.display = (menu.style.display === "block") ? "none" : "block";
}
function applyFocusTheme() {
    let saved = localStorage.getItem("theme");

    // remove old focus theme first
    document.body.classList.remove("focus-theme");

    // ✅ apply ONLY if nature theme
    if (saved === "nature") {
        document.body.classList.add("focus-theme");
    }
}
// run only on focus page
if (window.location.pathname === "/focus") {
    applyFocusTheme();
}
function createPetals() {
    let saved = localStorage.getItem("theme");

    if (saved !== "nature") return; // ✅ stop for other themes

    for (let i = 0; i < 10; i++) {
        let petal = document.createElement("div");
        petal.className = "petal";

        petal.style.left = Math.random() * 100 + "vw";
        petal.style.animationDuration = (3 + Math.random() * 5) + "s";
        petal.style.animationDelay = Math.random() * 5 + "s";

        document.body.appendChild(petal);
    }
}

window.onload = function () {
    let saved = localStorage.getItem("theme");

    document.body.classList.remove("dark", "nature", "focus-theme");

    if (saved) {
        document.body.classList.add(saved);
    }

    if (window.location.pathname === "/focus") {
        applyFocusTheme();
    }

    createPetals(); // 🌸 ADD THIS
};
/*document.addEventListener("click", function (e) {

    let saved = localStorage.getItem("theme");
    if (saved !== "nature") return; // ✅ only nature theme

    let ripple = document.createElement("div");
    ripple.className = "ripple";

    ripple.style.left = e.clientX + "px";
    ripple.style.top = e.clientY + "px";

    document.body.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
});*/
document.addEventListener("click", function(e) {
    const menu = document.querySelector(".theme-menu");
    const dropdown = document.getElementById("themeOptions");

    if (menu && dropdown && !menu.contains(e.target)) {
        dropdown.style.display = "none";
    }
});
// run only on home page
if (document.getElementById("taskList")) {
    showTasks();
}
// run only on focus page
if (document.getElementById("taskSelect")) {
    loadTasksToDropdown();
}
if (document.getElementById("totalTasks")) {
    showTasks();
}
if (document.getElementById("focusList")) {
    loadDashboard();
}