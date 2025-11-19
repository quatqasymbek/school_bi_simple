// ===============================
// dashboard_student.js (FULL)
// ===============================

console.log("DASHBOARD_STUDENT Loaded");

window.SBI_Students = {

    init() {
        this.elClass = document.getElementById("stClassSelect");
        this.elTerm  = document.getElementById("stTermSelect");
        this.elTable = document.getElementById("stTableWrapper");
        this.elBtn   = document.getElementById("stRefreshBtn");

        this.elBtn.addEventListener("click", () => this.render());

        if (window.SBI?.state?.allRows?.length) {
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

        // -------- Fill Classes ----------
        this.elClass.innerHTML = "";
        st.classes
            .sort((a,b)=>a.class_id.localeCompare(b.class_id,"ru"))
            .forEach(c=>{
                const o=document.createElement("option");
                o.value=c.class_id;
                o.textContent=c.class_id + " — " + c.class_name;
                this.elClass.appendChild(o);
            });

        // -------- Fill Terms ------------
        this.elTerm.innerHTML = "";
        st.allTerms.forEach(t=>{
            const o=document.createElement("option");
            o.value=t;
            o.textContent=t;
            this.elTerm.appendChild(o);
        });
    },

    render() {
        const st = SBI.state;

        if (!st.allRows.length) {
            this.elTable.innerHTML = "<p>Нет данных</p>";
            return;
        }

        const classId = this.elClass.value;
        const termId  = this.elTerm.value;

        const students = st.students.filter(s=>s.class_id===classId);
        const subjects = st.subjects.sort((a,b)=>
            a.subject_name.localeCompare(b.subject_name,"ru")
        );

        let html = `<table class="data-table"><thead><tr>
            <th>Ученик</th><th>ID</th>`;

        subjects.forEach(s => html += `<th>${s.subject_name}</th>`);
        html += `<th>Средний балл</th></tr></thead><tbody>`;

        students.forEach(s=>{
            const rows = st.allRows.filter(r =>
                r.student_id==s.student_id && r.term==termId
            );

            html += `<tr>
                <td>${s.last_name} ${s.first_name}</td>
                <td>${s.student_id}</td>`;

            let total=0, cnt=0;

            subjects.forEach(sub=>{
                const row = rows.find(r=>r.subject_id==sub.subject_id);
                if (row) {
                    html += `<td>${row.final_5scale}</td>`;
                    total+=row.final_5scale; cnt++;
                } else html += `<td>-</td>`;
            });

            html += `<td>${cnt ? (total/cnt).toFixed(2) : "-"}</td></tr>`;
        });

        html += "</tbody></table>";
        this.elTable.innerHTML = html;
    }
};

document.addEventListener("DOMContentLoaded", () => {
    SBI_Students.init();
});
