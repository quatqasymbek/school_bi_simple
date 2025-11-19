// ===============================
//  overview.js  (FULL, FIXED)
// ===============================

console.log("OVERVIEW_JS Loaded");

window.SBI_Overview = {
    init() {
        this.elTermSelect   = document.getElementById("ovTermSelect");
        this.elMetricSelect = document.getElementById("ovMetricSelect");
        this.elUpdateBtn    = document.getElementById("btn-overview-refresh");

        this.elDonut   = document.getElementById("chart-overview-donut");
        this.elGrades  = document.getElementById("chart-overview-grades");
        this.elAiOut   = document.getElementById("overview-ai-output");

        this.elKpiStudents = document.getElementById("ovKpiStudents");
        this.elKpiTeachers = document.getElementById("ovKpiTeachers");

        if (this.elUpdateBtn) {
            this.elUpdateBtn.addEventListener("click", () => this.update());
        }

        if (window.SBI?.state?.allRows?.length) {
            this.populateSelectors();
            this.update();
        }
    },

    onDataLoaded() {
        this.populateSelectors();
        this.update();
    },

    populateSelectors() {
        if (!SBI.state || !SBI.state.allTerms) return;

        this.elTermSelect.innerHTML = "";
        SBI.state.allTerms.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            this.elTermSelect.appendChild(opt);
        });
    },

    // --------------------------------------------------------
    // ✔ FIX — Prevent crash when data not loaded yet
    // --------------------------------------------------------
    update() {
        if (!window.SBI || !SBI.state || !Array.isArray(SBI.state.allRows)) {
            console.warn("Overview: data not ready, skipping update.");
            return;
        }

        const term = this.elTermSelect.value || SBI.state.allTerms[0];
        const metric = this.elMetricSelect.value;

        this.updateKPIs();
        this.renderDonut(term);
        this.renderGradeBars();
    },

    updateKPIs() {
        const st = SBI.state;
        this.elKpiStudents.textContent = st.students.length || "-";
        this.elKpiTeachers.textContent = st.teachers.length || "-";
    },

    renderDonut(term) {
        if (!this.elDonut) return;

        const rows = SBI.state.allRows.filter(r => r.term == term);

        let groups = { dvoe: 0, troe: 0, horo: 0, otl: 0 };
        const byStudent = {};

        rows.forEach(r => {
            if (!byStudent[r.student_id]) {
                byStudent[r.student_id] = { min: 5 };
            }
            if (r.final_5scale < byStudent[r.student_id].min) {
                byStudent[r.student_id].min = r.final_5scale;
            }
        });

        Object.values(byStudent).forEach(s => {
            if (s.min <= 2) groups.dvoe++;
            else if (s.min == 3) groups.troe++;
            else if (s.min == 4) groups.horo++;
            else groups.otl++;
        });

        const data = [{
            type: "pie",
            hole: 0.5,
            labels: ["Отличники", "Хорошисты", "Троечники", "Двоечники"],
            values: [groups.otl, groups.horo, groups.troe, groups.dvoe],
            textinfo: "label+percent",
        }];

        Plotly.newPlot(this.elDonut, data, {
            title: `Распределение по итогам четверти`,
        });
    },

    renderGradeBars() {
        if (!this.elGrades) return;

        const rows = SBI.state.allRows;

        const byGrade = {};
        rows.forEach(r => {
            const g = r.grade;
            if (!byGrade[g]) byGrade[g] = [];
            byGrade[g].push(r.final_5scale);
        });

        const grades = Object.keys(byGrade).sort((a,b)=>a-b);
        const avg = grades.map(g => 
            (byGrade[g].reduce((a,b)=>a+b,0) / byGrade[g].length).toFixed(2)
        );

        const data = [{
            x: grades,
            y: avg,
            type: "bar",
            marker: { color: "#2c78e0" }
        }];

        Plotly.newPlot(this.elGrades, data, {
            title: "Средняя оценка по параллелям",
            yaxis: { range: [2,5] }
        });
    },
};

document.addEventListener("DOMContentLoaded", () => {
    window.SBI_Overview.init();
});
