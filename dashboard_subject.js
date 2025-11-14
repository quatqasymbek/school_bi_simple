// dashboard_subject.js
window.SBI_Subject = (function () {
    const state = SBI.state;

    let subjectSelect, termSelect;
    let chartClass, chartDist, chartTrend;

    function init() {
        subjectSelect = document.getElementById("subjectSubjectSelect");
        termSelect = document.getElementById("subjectTermSelect");

        chartClass = document.getElementById("chart-subject-class");
        chartDist = document.getElementById("chart-subject-dist");
        chartTrend = document.getElementById("chart-subject-trend");

        if (subjectSelect) subjectSelect.addEventListener("change", update);
        if (termSelect) termSelect.addEventListener("change", update);
    }

    function populateFilters() {
        const { allRows } = state;
        if (!allRows.length) return;

        const terms = SBI.unique(allRows.map(r => r.term));
        const subjects = SBI.unique(allRows.map(r => r.subject));

        if (subjectSelect) {
            subjectSelect.innerHTML = '<option value="all">All subjects</option>';
            subjects.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s; opt.textContent = s;
                subjectSelect.appendChild(opt);
            });
        }

        if (termSelect) {
            termSelect.innerHTML = '<option value="all">All terms</option>';
            terms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t; opt.textContent = t;
                termSelect.appendChild(opt);
            });
        }
    }

    function filteredRows() {
        const { allRows } = state;
        const subj = subjectSelect?.value || "all";
        const term = termSelect?.value || "all";

        return allRows.filter(r =>
            (subj === "all" || r.subject === subj) &&
            (term === "all" || r.term === term)
        );
    }

    function computeSubjectClassAverages(rows) {
        const groups = {};
        rows.forEach(r => {
            if (!r.class) return;
            const val = Number(r.final_percent ?? r.final_5scale ?? NaN);
            if (Number.isNaN(val)) return;

            if (!groups[r.class]) groups[r.class] = [];
            groups[r.class].push(val);
        });

        return Object.entries(groups).map(([cls, vals]) => ({
            class: cls,
            avg: SBI.mean(vals),
            std: SBI.std(vals),
            n: vals.length
        })).sort((a,b)=>(b.avg ?? 0)-(a.avg ?? 0));
    }

    function renderClassChart(stats) {
        if (!chartClass) return;

        if (!stats.length) {
            Plotly.newPlot(chartClass, [], {
                title: "No data (class averages)",
                xaxis: { title: "Class" },
                yaxis: { title: "Average grade" }
            });
            return;
        }

        Plotly.newPlot(chartClass, [{
            x: stats.map(s => s.class),
            y: stats.map(s => s.avg),
            text: stats.map(s => `N=${s.n}, σ≈${s.std?.toFixed(1) ?? "NA"}`),
            type: "bar"
        }], {
            title: "Average grade by class (selected subject)",
            xaxis: { title: "Class" },
            yaxis: { title: "Average grade" }
        });
    }

    function renderDistribution(rows) {
        if (!chartDist) return;

        const vals = rows
            .map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
            .filter(v => !Number.isNaN(v));

        if (!vals.length) {
            Plotly.newPlot(chartDist, [], {
                title: "No data (distribution)",
                xaxis: { title: "Grade" },
                yaxis: { title: "Number of students" }
            });
            return;
        }

        Plotly.newPlot(chartDist, [{
            x: vals,
            type: "histogram"
        }], {
            title: "Distribution of grades (selected subject)",
            xaxis: { title: "Grade" },
            yaxis: { title: "Students" }
        });
    }

    function computeTrend(subj) {
        const { allRows, allTerms } = state;
        if (!subj || subj === "all") return [];

        const byTerm = {};
        allRows.forEach(r => {
            if (r.subject !== subj) return;
            const val = Number(r.final_percent ?? r.final_5scale ?? NaN);
            if (Number.isNaN(val)) return;

            if (!byTerm[r.term]) byTerm[r.term] = [];
            byTerm[r.term].push(val);
        });

        return allTerms.map(t => ({
            term: t,
            avg: byTerm[t] ? SBI.mean(byTerm[t]) : null
        }));
    }

    function renderTrend(subj) {
        if (!chartTrend) return;
        if (!subj || subj === "all") {
            Plotly.newPlot(chartTrend, [], {
                title: "Select a subject to see trend",
                xaxis: { title: "Term" },
                yaxis: { title: "Average grade" }
            });
            return;
        }

        const trend = computeTrend(subj);
        const valid = trend.filter(p => p.avg !== null);
        if (!valid.length) {
            Plotly.newPlot(chartTrend, [], {
                title: "No data (trend)",
                xaxis: { title: "Term" },
                yaxis: { title: "Average grade" }
            });
            return;
        }

        Plotly.newPlot(chartTrend, [{
            x: trend.map(p => p.term),
            y: trend.map(p => p.avg),
            mode: "lines+markers"
        }], {
            title: `Trend across terms (subject: ${subj})`,
            xaxis: { title: "Term" },
            yaxis: { title: "Average grade" }
        });
    }

    function update() {
        const rows = filteredRows();
        SBI.log && SBI.log(`By Subject → filtered rows: ${rows.length}`);

        const stats = computeSubjectClassAverages(rows);
        renderClassChart(stats);
        renderDistribution(rows);

        const subj = subjectSelect?.value || "all";
        renderTrend(subj);
    }

    function onDataLoaded() {
        populateFilters();
        update();
    }

    return {
        init,
        onDataLoaded,
        update
    };
})();
