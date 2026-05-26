from flask import Flask, render_template, request, jsonify
import sqlite3
from flask import session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "tulip2005"

app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"

@app.route("/")
def home():
    return render_template("login.html")

def init_db():
    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT,
        done INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        user TEXT,
        priority INTEGER DEFAULT 2,
        deadline TEXT
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
    """)

    conn.commit()
    conn.close()

init_db()

@app.route("/signup-page")
def signup_page():
    return render_template("signup.html")

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    # 🚫 BLOCK EMPTY INPUT
    if not username or not password:
        return jsonify({"error": "Username and password required"})

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            (username, generate_password_hash(password))
        )
        conn.commit()
    except:
        return jsonify({"error": "User already exists"})

    conn.close()

    return jsonify({"message": "Signup successful"})

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"error": "Enter username & password"})

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cur.fetchone()

    conn.close()

    if user and check_password_hash(user[2], password):
        session["user"] = user[1]
        print("LOGIN SUCCESS:", session)
        return jsonify({"message": "success"})
    else:
        return jsonify({"error": "Invalid credentials"})

@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect("/")

@app.route("/dashboard")
def dashboard():
    if "user" not in session:
        return redirect("/")
    return render_template("dashboard.html")

@app.route("/tasks-page")
def tasks_page():
    if "user" not in session:
        return redirect("/")
    return render_template("index.html")

@app.route("/add", methods=["POST"])
def add_task():
    if "user" not in session:
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json()

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO tasks (task, done, duration,user, priority, deadline) VALUES (?, ?, ?, ?, ?, ?)",
        (
            data["task"], 
            0, 
            data.get("duration", 0), 
            session["user"],
            data.get("priority", 2),
            data.get("deadline")
        )
    )

    conn.commit()
    conn.close()

    return jsonify({"message": "added"})

@app.route("/tasks")
def get_tasks():
    if "user" not in session:
        return jsonify([])

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM tasks WHERE user = ?",
        (session["user"],)
    )
    rows = cur.fetchall()

    conn.close()

    data = []
    for row in rows:
        data.append({
            "id": row[0],
            "task": row[1],
            "duration": row[3],
            "done": bool(row[2]),
            "priority": row[5],
            "deadline": row[6]
    
        })

    return jsonify(data)

@app.route("/delete/<int:id>", methods=["DELETE"])
def delete_task(id):
    if "user" not in session:
        return jsonify({"error": "unauthorized"}), 401

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute(
        "DELETE FROM tasks WHERE id = ? AND user = ?",
        (id, session["user"])
    )

    conn.commit()
    conn.close()

    return jsonify({"message": "deleted"})

@app.route("/complete/<int:id>", methods=["PUT"])
def complete_task(id):
    if "user" not in session:
        return jsonify({"error": "unauthorized"}), 401

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute(
        "UPDATE tasks SET done = 1 WHERE id = ? AND user = ?",
        (id, session["user"])
    )

    conn.commit()
    conn.close()

    return jsonify({"message": "completed"})

@app.route("/focus")
def focus():
    return render_template("focus.html")

# ai recommendation
from datetime import datetime

@app.route("/recommend")
def recommend():
    if "user" not in session:
        return jsonify(["Login required"])

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute("""
        SELECT task, duration, done, priority, deadline 
        FROM tasks 
        WHERE user = ?
    """, (session["user"],))

    tasks = cur.fetchall()
    conn.close()

    if not tasks:
        return jsonify(["📭 Add tasks to get suggestions"])

    pending = [t for t in tasks if t[2] == 0]

    suggestions = []

    # 🔥 priority-based
    high_priority = [t for t in pending if t[3] == 1]
    if high_priority:
        suggestions.append(f"🔥 Start with high priority: {high_priority[0][0]}")

    # ⏰ deadline-based
    today = datetime.today().date()
    urgent = []
    for t in pending:
        if t[4]:
            try:
                d = datetime.strptime(t[4], "%Y-%m-%d").date()
                if d <= today:
                    urgent.append(t)
            except:
                pass

    if urgent:
        suggestions.append(f"⚠️ Urgent task: {urgent[0][0]}")

    # 🧠 overload detection
    if len(pending) > 5:
        suggestions.append("📋 Too many tasks — focus on top 3")

    # ⏱ long task
    long_tasks = [t for t in pending if t[1] and t[1] > 45]
    if long_tasks:
        suggestions.append(f"🧠 Break into smaller parts: {long_tasks[0][0]}")

    # ✅ fallback
    suggestions.append("🔥 Stay consistent — small progress daily matters")

    return jsonify(suggestions)

@app.route("/ai")
def ai_page():
    return render_template("ai.html")

@app.route("/dashboard-data")
def dashboard_data():
    if "user" not in session:
        return jsonify({})
    
    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute(
        "SELECT id, task, duration, done, priority, deadline FROM tasks WHERE user = ?",
        (session["user"],)
    )
    tasks = cur.fetchall()
    conn.close()

    data = []

    from datetime import datetime

    today = datetime.today().date()

    for t in tasks:
        deadline = t[5]
        deadline_date = None

        if deadline:
            try:
                deadline_date = datetime.strptime(deadline, "%Y-%m-%d").date()
            except:
                pass

        data.append({
            "id": t[0],
            "task": t[1],
            "duration": t[2],
            "done": t[3],
            "priority": t[4] if t[4] else 2,
            "deadline": deadline,
            "deadline_date": deadline_date
        })

    # ✅ separate
    pending = [t for t in data if t["done"] == 0]

    # 🔥 SMART SORT (priority + deadline + duration)
    def sort_key(t):
        return (
            t["priority"],                              # high first
            (t["deadline_date"] or today),             # earliest deadline
            t["duration"] if t["duration"] else 999    # shorter tasks
        )

    pending_sorted = sorted(pending, key=sort_key)

    # 🔥 top focus tasks
    focus = pending_sorted[:3]

    # ⚠️ overdue
    overdue = [
        t for t in pending
        if t["deadline_date"] and t["deadline_date"] < today
    ]

    # 📊 stats
    total = len(data)
    completed = len([t for t in data if t["done"] == 1])
    total_time = sum(t["duration"] for t in data)

    return jsonify({
        "focus": focus,
        "overdue": overdue,
        "total": total,
        "completed": completed,
        "time": total_time
    })

@app.route("/smart-plan")
def smart_plan():

    if "user" not in session:
        return jsonify(["Login required"])

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    cur.execute("""
        SELECT task, duration, priority, deadline 
        FROM tasks 
        WHERE user = ? AND done = 0
    """, (session["user"],))

    tasks = cur.fetchall()
    conn.close()

    if not tasks:
        return jsonify(["No pending tasks 🎉"])

    from datetime import datetime
    today = datetime.today().date()

    # 🔥 SORT (priority + deadline)
    def sort_key(t):
        priority = t[2] or 2
        deadline = t[3]

        try:
            deadline_date = datetime.strptime(deadline, "%Y-%m-%d").date() if deadline else today
        except:
            deadline_date = today

        return (priority, deadline_date)

    tasks.sort(key=sort_key)

    # 🔥 BUILD PLAN
    plan = []
    day = 1
    daily_limit = 90   # 1.5 hrs/day
    used = 0
    day_tasks = []

    for task, duration, priority, deadline in tasks:

        duration = duration or 30

        # 🔥 split long tasks
        while duration > 60:
            day_tasks.append(f"{task} (60m)")
            duration -= 60
            used += 60

            if used >= daily_limit:
                plan.append(f"Day {day}: " + ", ".join(day_tasks))
                day += 1
                used = 0
                day_tasks = []

        if used + duration > daily_limit:
            plan.append(f"Day {day}: " + ", ".join(day_tasks))
            day += 1
            used = 0
            day_tasks = []

        label = f"{task} ({duration}m)"

        if deadline:
            label += f" 📅 {deadline}"

        day_tasks.append(label)
        used += duration

    if day_tasks:
        plan.append(f"Day {day}: " + ", ".join(day_tasks))

    return jsonify(plan)

@app.route("/apply-plan", methods=["POST"])
def apply_plan():
    if "user" not in session:
        return jsonify({"error": "login required"}), 401

    data = request.get_json()
    tasks = data.get("tasks", [])

    conn = sqlite3.connect("study.db")
    cur = conn.cursor()

    for t in tasks:
        cur.execute(
            "INSERT INTO tasks (task, done, duration, user, priority) VALUES (?, ?, ?, ?, ?)",
            (t["task"], 0, t["duration"], session["user"], 2)
        )

    conn.commit()
    conn.close()

    return jsonify({"message": "Plan added to tasks"})

if __name__ == "__main__":
    app.run(debug=True)