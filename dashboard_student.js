// ===============================
// dashboard_student.js (FIXED)
// ===============================

console.log("DASHBOARD_STUDENT Loaded");

window.SBI_Students = {
    // Cache DOM references (used by init + onDataLoaded)
    cacheDom() {
        this.selClass = document.getElementById("stClassSelect");
        this.selTerm  = document.getElementById("stTermSelect");
        this.btn      = document.getElementById("stRefreshBtn");
        this.tableBox = document.getElementById("stTableWrapper");
    },

    init() {
        this.cacheDom();

        // If critical DOM elements are missing, do nothing (avoid runtime errors)
        if (!this.selClass || !this.selTerm || !this.tableBox) {
            console.warn("SBI_Students.init: Missing required DOM elements.");
            return;
        }

        if (this.btn) {
            this.btn.addEventListener("click", () => this.render());
        }

        const st = window.SBI?.state;
        if (st?.allRows?.length) {
            this.populate();
            this.render();
        }
    },

    // Call this after data is loaded into SBI.state
    onDataLoaded() {
        // Ensure DOM is cached (in case this was called before init or outside DOMContentLoaded)
        if (!this.selClass || !this.selTerm || !this.tableBox) {
            this.cacheDom();
        }

        const st = window.SBI?.state;
        if (!st) {
            console.warn("SBI_Students.onDataLoaded: SBI.state is not available.");
            return;
        }

        if (!this.selClass || !this.selTerm || !this.tableBox) {
            console.warn("SBI_Students.onDataLoaded: Missing required DOM elements.");
            return;
        }

        this.populate();
        this.render();
    },

    populate() {
        const st = window.SBI?.state;

        if (!st) {
            console.warn("SBI_Students.populate: SBI.state is not available.");
            return;
        }
        if (!this.selClass || !this.selTerm) {
            console.warn("SBI_Students.populate: Missing select elements.");
            return;
        }

        // --- classes ---
        this.selClass.innerHTML = "";
        (st.classes || [])
            .slice() // non-mutating sort
            .sort((a, b) => String(a.class_id).localeCompare(String(b.class_id), "ru"))
            .forEach(c => {
                const o = document.createElement("option");
                o.value = c.class_id;
                o.textContent = `${c.class_id} — ${c.class_name || ""}`;
                this.selClass.appendChild(o);
            });

        // --- terms ---
        this.selTerm.innerHTML = "";
        (st.allTerms || []).forEach(t => {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            this.selTerm.appendChild(o);
        });
    },

    render() {
        const st = window.SBI?.state;

        if (!st) {
            console.warn("SBI_Students.render: SBI.state is not available.");
            return;
        }
        if (!this.selClass || !this.selTerm || !this.tableBox) {
            console.warn("SBI_Students.render: Missing required DOM elements.");
            return;
        }

        const classId = this.selClass.value;
        const termId  = this.selTerm.value;

        if (!classId || !termId) {
            this.tableBox.innerHTML = "<p>Пожалуйста, выберите класс и четверть.</p>";
            return;
        }

        const students = (st.students || []).filter(s => s.class_id == classId);
        const subjects = (st.subjects || [])
            .slice() // non-mutating sort
            .sort((a, b) => String(a.subject_name).localeCompare(String(b.subject_name), "ru"));

        if (!students.length || !subjects.length) {
            this.tableBox.innerHTML = "<p>Нет данных для отображения.</p>";
            return;
        }

        let html = `<table class="data-table"><thead><tr>
            <th>Ученик</th>
            <th>ID</th>`;

        subjects.forEach(s => {
            html += `<th>${s.subject_name}</th>`;
        });

        html += `<th>Средний балл</th></tr></thead><tbody>`;

        students.forEach(s => {
            const rows = (st.allRows || []).filter(r =>
                r.student_id == s.student_id && r.term == termId
            );

            html += `<tr>
                <td>${[s.last_name, s.first_name].filter(Boolean).join(" ")}</td>
                <td>${s.student_id}</td>`;

            let sum = 0;
            let count = 0;

            subjects.forEach(sub => {
                const row = rows.find(r => r.subject_id == sub.subject_id);

                if (row && row.final_5scale != null && row.final_5scale !== "") {
                    const grade = Number(row.final_5scale);
                    if (!Number.isNaN(grade)) {
                        html += `<td>${grade}</td>`;
                        sum += grade;
                        count++;
                    } else {
                        console.warn("Non-numeric final_5scale value:", row);
                        html += `<td>-</td>`;
                    }
                } else {
                    html += `<td>-</td>`;
                }
            });

            html += `<td>${count ? (sum / count).toFixed(2) : "-"}</td></tr>`;
        });

        html += "</tbody></table>";

        this.tableBox.innerHTML = html;
    }
};

document.addEventListener("DOMContentLoaded", () => {
    if (window.SBI_Students) {
        window.SBI_Students.init();
    }
});
