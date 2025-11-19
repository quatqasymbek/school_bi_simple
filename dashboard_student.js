// ===============================
// dashboard_student.js (FIXED FINAL)
// ===============================

console.log("DASHBOARD_STUDENT Loaded");

window.SBI_Students = {
    cacheDom() {
        this.selClass = document.getElementById("stClassSelect");
        this.selTerm  = document.getElementById("stTermSelect");
        this.btn      = document.getElementById("stRefreshBtn");
        this.tableBox = document.getElementById("stTableWrapper");
    },

    init() {
        this.cacheDom();

        if (!this.selClass || !this.selTerm || !this.tableBox) {
            console.warn("❗ Missing dashboard UI elements in HTML.");
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

    onDataLoaded() {
        if (!this.selClass || !this.selTerm || !this.tableBox) {
            this.cacheDom();
        }

        const st = window.SBI?.state;
        if (!st) {
            console.warn("SBI.state not available");
            return;
        }

        this.populate();
        this.render();
    },

    populate() {
        const st = window.SBI?.state;
        if (!st) return;

        this.selClass.innerHTML = "";
        (st.classes || [])
            .slice()
            .sort((a, b) => String(a.class_id).localeCompare(String(b.class_id), "ru"))
            .forEach(c => {
                const o = document.createElement("option");
                o.value = c.class_id;
                o.textContent = `${c.class_id} — ${c.class_name || ""}`;
                this.selClass.appendChild(o);
            });

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
        if (!st) return;

        const classId = this.selClass.value;
        const termId  = this.selTerm.value;

        if (!classId || !termId) {
            this.tableBox.innerHTML = "<p>Выберите класс и четверть.</p>";
            return;
        }

        const students = (st.students || []).filter(s => s.class_id == classId);
        const subjects = (st.subjects || [])
            .slice()
            .sort((a, b) => String(a.subject_name).localeCompare(String(b.subject_name), "ru"));

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

                if (row && row.final_5scale != null) {
                    const grade = Number(row.final_5scale);
                    if (!Number.isNaN(grade)) {
                        html += `<td>${grade}</td>`;
                        sum += grade;
                        count++;
                    } else {
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
    if (window.SBI_Students) window.SBI_Students.init();
});
