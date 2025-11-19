// dashboard_student.js
console.log("DASHBOARD_STUDENT_JS Loaded");

window.SBI_Students = {
    init() {
        this.elClass = document.getElementById("stClassSelect");
        this.elTerm  = document.getElementById("stTermSelect");
        this.elTable = document.getElementById("stTableWrapper");
        this.elBtn   = document.getElementById("stRefreshBtn");

        this.elBtn.addEventListener("click", () => this.render());

        if (window.SBI?.state?.allRows?.length) {
            this.populateSelectors();
            this.render();
        }
    },

    onDataLoaded() {
        this.populateSelectors();
        this.render();
    },

    populateSelectors() {
        const st = SBI.state;

        // Fill class list
        this.elClass.innerHTML = "";
        st.classes
            .sort((a, b) => a.class_id.localeCompare(b.class_id, "ru"))
            .forEach(c => {
                const o = document.createElement("option");
                o.value = c.class_id;
                o.textContent = c.class_id + " — " + c.class_name;
                this.elClass.appendChild(o);
            });

        // Fill term list
        this.elTerm.innerHTML = "";
        st.allTerms.forEach(t => {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            this.elTerm.appendChild(o);
        });
    },

    render() {
        const st = SBI.state;

        if (!st.allRows || st.allRows.length === 0) {
            this.elTable.innerHTML =
                `<div class="empty-msg">Нет данных. Загрузите файлы Excel.</div>`;
            return;
        }

        const classId = this.elClass.value;
        const termId  = this.elTerm.value;

        const students = st.students.filter(s => s.class_id === classId);
        const subjects = st.subjects.sort((a, b) =>
            a.subject_name.localeCompare(b.subject_name, "ru")
        );

        let html = `<table class="std-table">
            <thead>
                <tr>
                    <th>Ученик</th>
                    <th>ID</th>`;

        subjects.forEach(sub => {
            html += `<th>${sub.subject_name}</th>`;
        });

        html += `<th>Средний балл</th></tr></thead><tbody>`;

        students.forEach(stu => {
            const rows = st.allRows.filter(r =>
                r.student_id == stu.student_id &&
                r.class_id == classId &&
                r.term == termId
            );

            html += `<tr>
                <td>${stu.last_name} ${stu.first_name}</td>
                <td>${stu.student_id}</td>`;

            let total = 0;
            let count = 0;

            subjects.forEach(sub => {
                const row = rows.find(r => r.subject_id == sub.subject_id);

                if (row) {
                    html += `<td>${row.final_5scale}</td>`;
                    total += row.final_5scale;
                    count++;
                } else {
                    html += `<td>-</td>`;
                }
            });

            const avg = count === 0 ? "-" : (total / count).toFixed(2);
            html += `<td>${avg}</td></tr>`;
        });

        html += `</tbody></table>`;
        this.elTable.innerHTML = html;
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.SBI_Students.init();
});
