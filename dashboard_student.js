// ===============================
// dashboard_student.js (FINAL WORKING)
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
            console.warn("SBI_Students: Required DOM missing");
            return;
        }

        if (this.btn) {
            this.btn.addEventListener("click", () => this.render());
        }
    },

    onDataLoaded() {
        this.cacheDom();

        if (!SBI.state) return;

        this.populate();
        this.render();
    },

    populate() {
        const st = SBI.state;

        this.selClass.innerHTML = "";
        (st.classes || [])
            .slice()
            .sort((a, b) => String(a.class_id).localeCompare(String(b.class_id), "ru"))
            .forEach(c => {
                const o = document.createElement("option");
                o.value = c.class_id;
                o.textContent = c.class_name || c.class_id;
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
        const st = SBI.state;
        if (!st) return;

        const classId = this.selClass.value;
        const termId  = this.selTerm.value;

        const students = st.students.filter(s => s.class_id == classId);
        const subjects = st.subjects.slice().sort((a,b)=>
            a.subject_name.localeCompare(b.subject_name, "ru")
        );

        let html = `<table class="data-table"><thead><tr>
            <th>Ученик</th>
            <th>ID</th>`;

        subjects.forEach(s => html += `<th>${s.subject_name}</th>`);

        html += `<th>Средний балл</th></tr></thead><tbody>`;

        students.forEach(s => {
            const rows = st.allRows.filter(r =>
                r.student_id == s.student_id && r.term == termId
            );

            html += `<tr>
                <td>${s.last_name || ""} ${s.first_name || ""}</td>
                <td>${s.student_id}</td>`;

            let sum = 0, count = 0;

            subjects.forEach(sub => {
                const row = rows.find(r => r.subject_id == sub.subject_id);

                if (row && row.final_5scale != null) {
                    html += `<td>${row.final_5scale}</td>`;
                    sum += Number(row.final_5scale);
                    count++;
                } else {
                    html += `<td>-</td>`;
                }
            });

            html += `<td>${count ? (sum/count).toFixed(2) : "-"}</td></tr>`;
        });

        html += "</tbody></table>";

        this.tableBox.innerHTML = html;
    }
};

document.addEventListener("DOMContentLoaded", () => SBI_Students.init());
