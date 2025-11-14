// dashboard_class.js
window.SBI_Class = (function () {
    const state = SBI.state;

    let termSelect, subjectSelect, classSelect;
    let chartAvg, chartDist, chartTrend, chartHeat;

    function init() {
        termSelect = document.getElementById("classTermSelect");
        subjectSelect = document.getElementById("classSubjectSelect");
        classSelect = document.getElementById("classClassSelect");

        chartAvg = document.getElementById("chart-class-avg");
        chartDist = document.getElementById("chart-class-dist");
        chartTrend = document.getElementById("chart-class-trend");
        chartHeat = document.getElementById("chart-class-heatmap");

        if (termSelect) termSelect.addEventListener("change", update);
        if (subjectSelect) subjectSelect.addEventListener("change", update);
        if (classSelect) classSelect.addEventListener("change", update);
    }

    function populateFilters() {
        const rows = state.allRows;
        if (!rows.length) return;

        const terms = state.allTerms;
        const subjects = state.allSubjects;
        const classes = state.allClasses;

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

    function filteredForRanking() {
        const rows = state.allRows;
        const term = termSelect?.value || "all";
        const subj = subjectSelect?.value || "all";

        return rows.filter(r =>
            (term === "all" || r.term === term) &&
            (subj === "all" || r.subject === subj)
        );
    }

    function computeClassStats(rows) {
        const groups = SBI.groupBy(
            rows,
            r => r.class,
            r => Number(r.final_percent ?? r.final_5scale ?? NaN)
        );

        return Object.entries(groups).map(([cls, vals]) => ({
            class: cls,
            avg: SBI.mean(vals),
            std: SBI.std(vals),
            n: vals.length
        })).sort((a,b)=>(b.avg ?? 0)-(a.avg ?? 0));
    }

    function renderRanking(stats) {
        if (!chartAvg) return;

        if (!stats.length) {
            Plotly.newPlot(chartAvg, [], {
                title: "No data for class ranking",
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

    function filteredForSelectedClass() {
        const rows = state.allRows;
        const term = termSelect?.value || "all";
        const subj = subjectSelect?.value || "all";
        const cls = classSelect?.value || "all";

        return rows.filter(r =>
            (term === "all" || r.term === term) &&
            (subj === "all" || r.subject === subj) &&
            (cls === "all" || r.class === cls)
        );
    }

    function renderDistribution(rows) {
        if (!chartDist) return;

        const vals = rows
            .map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
            .filter(v => !Number.isNaN(v));

        if (!vals.length) {
            Plotly.newPlot(chartDist, [], {
                title: "No data for grade distribution",
                xaxis: { title: "Grade" },
                yaxis: { title: "Number of students" }
            });
            return;
        }

        Plotly.newPlot(chartDist, [{
            x: vals,
            type: "histogram"
        }], {
            title: "Grade distribution in selected filter",
            xaxis: { title: "Grade" },
            yaxis: { title: "Students" }
        });
    }

    function computeClassTrend(cls) {
        const rows = state.allRows;
        const terms = state.allTerms;
        if (!cls || cls === "all") return [];

        const grouped = SBI.groupBy(
            rows.filter(r => r.class === cls),
            r => r.term,
            r => Number(r.final_percent ?? r.final_5scale ?? NaN)
        );

        return terms.map(t => ({
            term: t,
            avg: SBI.mean(grouped[t] || [])
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

    function renderHeatmap() {
        if (!chartHeat) return;
        const rows = state.allRows;
        const terms = state.allTerms;
        const classes = state.allClasses;

        const matrix = classes.map(cls => {
            return terms.map(term => {
                const vals = rows
                    .filter(r => r.class === cls && r.term === term)
                    .map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
                    .filter(v => !Number.isNaN(v));
                return SBI.mean(vals);
            });
        });

        Plotly.newPlot(chartHeat, [{
            z: matrix,
            x: terms,
            y: classes,
            type: "heatmap",
            colorscale: "Viridis"
        }], {
            title: "Class × Term heatmap (average grade)",
            xaxis: { title: "Term" },
            yaxis: { title: "Class" }
        });
    }

    function update() {
        const rankingRows = filteredForRanking();
        const stats = computeClassStats(rankingRows);
        SBI.log(`By Class → ranking rows: ${rankingRows.length}, classes: ${stats.length}`);
        renderRanking(stats);

        const clsRows = filteredForSelectedClass();
        SBI.log(`By Class → selected filter rows: ${clsRows.length}`);
        renderDistribution(clsRows);

        const selectedClass = classSelect?.value || "all";
        renderTrend(selectedClass);

        renderHeatmap();
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

SBI_Class.init();
