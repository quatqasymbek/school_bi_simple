// ===============================
// dashboard_student.js (FINAL)
// ===============================

console.log("DASHBOARD_STUDENT Loaded");

window.SBI_Students = {
    init() {
        this.selClass = document.getElementById("stClassSelect");
        this.selTerm  = document.getElementById("stTermSelect");
        this.btn      = document.getElementById("stRefreshBtn");
        this.tableBox = document.getElementById("stTableWrapper");

        if (this.btn) this.btn.addEventListener("click", () => this.render());

        if (SBI.state?.allRows?.length) {
            this.populate();
            this.render();
        }
    },

    onDataLoaded() {
        this.populate();
        this.render();
    },

    populate() {
        const st = SBI.state;

        // --- classes ---
        this.selClass.innerHTML = "";
        st.classes
            .sort((a,b)=>a.class_id.localeCompare(b.class_id, "ru"))
            .forEach(c=>{
                const o=document.createElement("option");
                o.value=c.class_id;
                o.textContent=c.class_id + " — " + c.class_name;
                this.selClass.appendChild(o);
            });

        // --- terms ---
        this.selTerm.innerHTML = "";
        st.allTerms.forEach(t=>{
            const o=document.createElement("option");
            o.value=t;
            o.textContent=t;
            this.selTerm.appendChild(o);
        });
    },

    render() {
        const st = SBI.state;
        const classId = this.selClass.value;
        const termId  = this.selTerm.value;

        const students = st.students.filter(s => s.class_id === classId);
        const subjects = st.subjects.sort((a,b)=>
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
                <td>${s.last_name} ${s.first_name}</td>
                <td>${s.student_id}</td>`;

            let sum = 0, count = 0;

            subjects.forEach(sub => {
                const row = rows.find(r => r.subject_id == sub.subject_id);
                if (row) {
                    html += `<td>${row.final_5scale}</td>`;
                    sum += row.final_5scale;
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
