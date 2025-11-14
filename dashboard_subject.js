// dashboard_subject.js
window.SBI_Subject = (function () {
    const state = SBI.state;

    let subjectSelect, termSelect;
    let chartClass, chartDist, chartTrend, chartHeat;

    function init() {
        subjectSelect = document.getElementById("subjectSubjectSelect");
        termSelect = document.getElementById("subjectTermSelect");

        chartClass = document.getElementById("chart-subject-class");
        chartDist = document.getElementById("chart-subject-dist");
        chartTrend = document.getElementById("chart-subject-trend");
        chartHeat = document.getElementById("chart-subject-heatmap");

        if (subjectSelect) subjectSelect.addEventListener("change", update);
        if (termSelect) termSelect.addEventListener("change", update);
    }

    function populateFilters() {
        const rows = state.allRows;
        if (!rows.length) return;

        const subjects = state.allSubjects;
        const terms = state.allTerms;

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
        const rows = state.allRows;
        const subj = subjectSelect?.value || "all";
        const term = termSelect?.value || "all";

        return rows.filter(r =>
            (subj === "all" || r.subject === subj) &&
            (term === "all" || r.term === term)
        );
    }

    function computeClassAverages(rows) {
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
            title: "Average grade by class (subject filter)",
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
                yaxis: { title: "Students" }
            });
            return;
        }

        Plotly.newPlot(chartDist, [{
            x: vals,
            type: "histogram"
        }], {
            title: "Distribution of grades (selected subject/term)",
            xaxis: { title: "Grade" },
            yaxis: { title: "Students" }
        });
    }

    function computeTrend(subj) {
        const rows = state.allRows;
        const terms = state.allTerms;
        if (!subj || subj === "all") return [];

        const grouped = SBI.groupBy(
            rows.filter(r => r.subject === subj),
            r => r.term,
            r => Number(r.final_percent ?? r.final_5scale ?? NaN)
        );

        return terms.map(t => ({
            term: t,
            avg: SBI.mean(grouped[t] || [])
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
                title: "No trend data for this subject",
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

    function renderHeatmap() {
        if (!chartHeat) return;
        const rows = state.allRows;
        const terms = state.allTerms;
        const subjects = state.allSubjects;

        const matrix = subjects.map(subj => {
            return terms.map(term => {
                const vals = rows
                    .filter(r => r.subject === subj && r.term === term)
                    .map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
                    .filter(v => !Number.isNaN(v));
                return SBI.mean(vals);
            });
        });

        Plotly.newPlot(chartHeat, [{
            z: matrix,
            x: terms,
            y: subjects,
            type: "heatmap",
            colorscale: "Viridis"
        }], {
            title: "Subject × Term heatmap (average grade)",
            xaxis: { title: "Term" },
            yaxis: { title: "Subject" }
        });
    }

    function update() {
        const rows = filteredRows();
        SBI.log(`By Subject → filtered rows: ${rows.length}`);

        const stats = computeClassAverages(rows);
        renderClassChart(stats);
        renderDistribution(rows);

        const subj = subjectSelect?.value || "all";
        renderTrend(subj);
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

SBI_Subject.init();
