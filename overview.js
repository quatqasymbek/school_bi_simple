// ===============================
//  overview.js  (FINAL & FIXED)
// ===============================

console.log("OVERVIEW_JS Loaded");

window.SBI_Overview = {
    init() {
        // Elements actually existing in your HTML
        this.termSelect   = document.getElementById("ovTermSelect");
        this.metricSelect = document.getElementById("ovMetricSelect");
        this.btnRefresh   = document.getElementById("btn-overview-refresh");

        this.kpiStudents  = document.getElementById("kpi-students");
        this.kpiTeachers  = document.getElementById("kpi-teachers");

        this.chartDonut   = document.getElementById("chart-overview-donut");
        this.chartGrades  = document.getElementById("chart-overview-grades");

        if (this.btnRefresh) {
            this.btnRefresh.addEventListener("click", () => this.update());
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
        if (!this.termSelect || !SBI.state?.allTerms) return;

        this.termSelect.innerHTML = "";
        SBI.state.allTerms.forEach(t => {
            const o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            this.termSelect.appendChild(o);
        });
    },

    update() {
        // ---- FIX crash if data not ready ----
        if (!SBI?.state?.allRows) {
            console.warn("Overview: data not ready. Skipping.");
            return;
        }

        this.updateKPIs();

        if (this.chartDonut)  this.renderDonut();
        if (this.chartGrades) this.renderGrades();
    },

    updateKPIs() {
        if (this.kpiStudents) this.kpiStudents.textContent = SBI.state.students.length;
        if (this.kpiTeachers) this.kpiTeachers.textContent = SBI.state.teachers.length;
    },

    renderDonut() {
        const term = this.termSelect?.value || SBI.state.allTerms[0];
        const rows = SBI.state.allRows.filter(r => r.term == term);

        const group = { 5:0, 4:0, 3:0, 2:0 };
        rows.forEach(r => group[r.final_5scale]++);

        Plotly.newPlot(this.chartDonut, [{
            type: "pie",
            hole: 0.5,
            labels: ["5", "4", "3", "2"],
            values: [group[5], group[4], group[3], group[2]]
        }], {
            title: `Распределение оценок (Четверть ${term})`
        });
    },

    renderGrades() {
        const rows = SBI.state.allRows;
        const grades = {};

        rows.forEach(r => {
            if (!grades[r.grade]) grades[r.grade] = [];
            grades[r.grade].push(r.final_5scale);
        });

        const x = Object.keys(grades).sort((a,b)=>a-b);
        const y = x.map(g => 
            grades[g].reduce((a,b)=>a+b,0) / grades[g].length
        );

        Plotly.newPlot(this.chartGrades, [{
            type: "bar",
            x, y,
            marker: { color: "#2c6ed9" }
        }], {
            title: "Средний балл по параллелям",
            yaxis: { range: [2,5] }
        });
    }
};

document.addEventListener("DOMContentLoaded", () => SBI_Overview.init());
