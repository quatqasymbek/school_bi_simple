// dashboard_class.js
window.SBI_Class = (function () {
    const state = SBI.state;

    let termSelect, subjectSelect, classSelect;
    let chartAvg, chartDist, chartTrend;

    function init() {
        termSelect = document.getElementById("classTermSelect");
        subjectSelect = document.getElementById("classSubjectSelect");
        classSelect = document.getElementById("classClassSelect");

        chartAvg = document.getElementById("chart-class-avg");
        chartDist = document.getElementById("chart-class-dist");
        chartTrend = document.getElementById("chart-class-trend");

        if (termSelect) termSelect.addEventListener("change", update);
        if (subjectSelect) subjectSelect.addEventListener("change", update);
        if (classSelect) classSelect.addEventListener("change", update);
    }

    function populateFilters() {
        const { allRows } = state;
        if (!allRows.length) return;

        const terms = SBI.unique(allRows.map(r => r.term));
        const subjects = SBI.unique(allRows.map(r => r.subject));
        const classes = SBI.unique(allRows.map(r => r.class));

        if (termSelect) {
            termSelect.innerHTML = '<option value="all">All terms</option>';
            terms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t; opt.textContent = t;
                termSelect.appendChild(opt);
            });
        }

        if (subjectSelect) {
            subjectSelect.innerHTML = '<option value="all">All subjects</option>';
            subjects.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s; opt.textContent = s;
                subjectSelect.appendChild(opt);
            });
        }

        if (classSelect) {
            classSelect.innerHTML = '<option value="all">All classes</option>';
            classes.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c; opt.textContent = c;
                classSelect.appendChild(opt);
            });
        }
    }

    function filteredRowsForRanking() {
        const { allRows } = state;
        if (!allRows.length) return [];

        const term = termSelect?.value || "all";
        const subj = subjectSelect?.value || "all";

        return allRows.filter(r =>
            (term === "all" || r.term === term) &&
            (subj === "all" || r.subject === subj)
        );
    }

    function computeClassStats(rows) {
        const groups = {}; // class -> { vals: [] }
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
        })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
    }

    function renderRanking(stats) {
        if (!chartAvg) return;
        if (!stats.length) {
            Plotly.newPlot(chartAvg, [], {
                title: "No data",
                xaxis: { title: "Class" },
                yaxis: { title: "Average grade" }
            });
            return;
        }

        Plotly.newPlot(chartAvg, [{
            x: stats.map(s => s.class),
            y: stats.map(s => s.avg),
            text: stats.map(s => `N=${s.n}, σ≈${s.std?.toFixed(1) ?? "NA"}`),
            type: "bar"
        }], {
            title: "Class ranking by average grade",
            xaxis: { title: "Class" },
            yaxis: { title: "Average grade" }
        });
    }

    function filteredRowsForSelectedClass() {
        const { allRows } = state;
        const term = termSelect?.value || "all";
        const subj = subjectSelect?.value || "all";
        const cls = classSelect?.value || "all";

        return allRows.filter(r =>
            (term === "all" || r.term === term) &&
            (subj === "all" || r.subject === subj) &&
            (cls === "all" || r.class === cls)
        );
    }

    function renderDistribution(rows) {
        if (!chartDist) return;

        const vals = rows.map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
            .filter(v => !Number.isNaN(v));

        if (!vals.length) {
            Plotly.newPlot(chartDist, [], {
                title: "No data for selected class",
                xaxis: { title: "Grade" },
                yaxis: { title: "Number of students" }
            });
            return;
        }

        Plotly.newPlot(chartDist, [{
            x: vals,
            type: "histogram"
        }], {
            title: "Grade distribution in selected class",
            xaxis: { title: "Grade" },
            yaxis: { title: "Students" }
        });
    }

    function computeClassTrend(cls) {
        const { allRows, allTerms } = state;
        if (!cls || cls === "all") return [];

        const byTerm = {};
        allRows.forEach(r => {
            if (r.class !== cls) return;
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

    function renderTrend(cls) {
        if (!chartTrend) return;
        if (!cls || cls === "all") {
            Plotly.newPlot(chartTrend, [], {
                title: "Select a class to see its trend",
                xaxis: { title: "Term" },
                yaxis: { title: "Average grade" }
            });
            return;
        }

        const trend = computeClassTrend(cls);
        const valid = trend.filter(p => p.avg !== null);
        if (!valid.length) {
            Plotly.newPlot(chartTrend, [], {
                title: "No trend data for this class",
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
            title: `Trend across terms for class ${cls}`,
            xaxis: { title: "Term" },
            yaxis: { title: "Average grade" }
        });
    }

    function update() {
        const rankingRows = filteredRowsForRanking();
        const stats = computeClassStats(rankingRows);
        SBI.log && SBI.log(`By Class → ranking rows: ${rankingRows.length}, classes: ${stats.length}`);
        renderRanking(stats);

        const clsRows = filteredRowsForSelectedClass();
        SBI.log && SBI.log(`By Class → selected class rows: ${clsRows.length}`);
        renderDistribution(clsRows);

        const selectedClass = classSelect?.value || "all";
        renderTrend(selectedClass);
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
