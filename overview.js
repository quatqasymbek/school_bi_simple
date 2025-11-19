// overview.js — FULL FILE WITH CRASH FIX APPLIED

console.log("OVERVIEW_JS Loaded");

window.SBI_Overview = {
    init() {
        this.elTermSelect = document.getElementById("ovTermSelect");
        this.elMetricSelect = document.getElementById("ovMetricSelect");
        this.elUpdateBtn = document.getElementById("ovUpdateBtn");
        this.elDonut = document.getElementById("chart-overview-donut");
        this.elTable = document.getElementById("overview-grade-term-table-body");
        this.elTermHeader = document.getElementById("overview-term-header");

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
            const o = document.createElement("option");
            o.value = t;
            o.textContent = t;
            this.elTermSelect.appendChild(o);
        });
    },

    // --------------------------------------------------
    //   FIX APPLIED HERE — prevents crash before data load
    // --------------------------------------------------
    update() {
        if (!window.SBI || !SBI.state || !SBI.state.allRows) {
            console.warn("Overview: SBI.state not ready yet — skipping update.");
            return;
        }

        const metric = this.elMetricSelect?.value ?? "knowledge_quality";
        const term = this.elTermSelect?.value ?? SBI.state.allTerms[0];

        this.renderDonut(term);
        this.renderTable(metric);
    },

    metricFromRows(rows, key) {
        if (!rows || rows.length === 0) {
            return { value: 0, count: 0 };
        }
        if (key === "knowledge_quality") {
            const good = rows.filter(r => r.final_5scale >= 4);
            return { value: (good.length / rows.length) * 100, count: rows.length };
        }
        if (key === "avg_mark") {
            const avg = rows.reduce((a, b) => a + b.final_5scale, 0) / rows.length;
            return { value: avg, count: rows.length };
        }
        return { value: 0, count: rows.length };
    },

    renderDonut(term) {
        if (!this.elDonut) return;

        const dist = this.classifyStudentsForTerm(term);

        const labels = ["Отличники", "Хорошисты", "Троечники", "Двоечники"];
        const values = [
            dist.Отличники,
            dist.Хорошисты,
            dist.Троечники,
            dist.Двоечники
        ];

        const data = [{
            values,
            labels,
            type: "pie",
            hole: 0.5,
            textinfo: "label+percent"
        }];

        Plotly.newPlot(this.elDonut, data, {
            title: `Распределение учащихся (${term})`,
            showlegend: true
        });
    },

    renderTable(metricKey) {
        if (!this.elTable) return;

        const matrix = {};
        const st = SBI.state;

        st.allRows.forEach(r => {
            if (!matrix[r.grade]) matrix[r.grade] = {};
            if (!matrix[r.grade][r.term]) matrix[r.grade][r.term] = [];
            matrix[r.grade][r.term].push(r);
        });

        let html = "";
        const grades = Object.keys(matrix).sort((a, b) => Number(a) - Number(b));
        const terms = st.allTerms;

        grades.forEach(g => {
            html += `<tr><td>${g}</td>`;
            terms.forEach(t => {
                const rows = matrix[g][t] ?? [];
                const m = this.metricFromRows(rows, metricKey);
                html += `<td>${m.value.toFixed(1)}</td>`;
            });
            html += `</tr>`;
        });

        this.elTable.innerHTML = html;
    },

    classifyStudentsForTerm(term) {
        const st = SBI.state;
        const rows = st.allRows.filter(r => r.term == term);

        const byStudent = {};
        rows.forEach(r => {
            if (!byStudent[r.student_id]) {
                byStudent[r.student_id] = { has2: false, has3: false, has4: false, has5: false };
            }
            if (r.final_5scale === 2) byStudent[r.student_id].has2 = true;
            if (r.final_5scale === 3) byStudent[r.student_id].has3 = true;
            if (r.final_5scale === 4) byStudent[r.student_id].has4 = true;
            if (r.final_5scale === 5) byStudent[r.student_id].has5 = true;
        });

        const out = {
            Отличники: 0,
            Хорошисты: 0,
            Троечники: 0,
            Двоечники: 0
        };

        Object.values(byStudent).forEach(s => {
            if (s.has2) out.Двоечники++;
            else if (s.has3) out.Троечники++;
            else if (s.has4) out.Хорошисты++;
            else if (s.has5) out.Отличники++;
        });

        return out;
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.SBI_Overview.init();
});
