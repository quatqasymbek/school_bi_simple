// dashboard_teacher.js
window.SBI_Teacher = (function () {
    const state = SBI.state;

    let teacherSelect, subjectSelect;
    let chartPerf, chartSubjects, chartTrend;

    function init() {
        teacherSelect = document.getElementById("teacherSelect");
        subjectSelect = document.getElementById("teacherSubjectSelect");

        chartPerf = document.getElementById("chart-teacher-performance");
        chartSubjects = document.getElementById("chart-teacher-subjects");
        chartTrend = document.getElementById("chart-teacher-trend");

        if (teacherSelect) teacherSelect.addEventListener("change", update);
        if (subjectSelect) subjectSelect.addEventListener("change", update);
    }

    function populateFilters() {
        const { allTeachers, allSubjects } = state;

        if (teacherSelect) {
            teacherSelect.innerHTML = '<option value="all">All teachers</option>';
            allTeachers.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.teacher_id;
                opt.textContent = t.teacher_name || t.teacher_id;
                teacherSelect.appendChild(opt);
            });
        }

        if (subjectSelect) {
            subjectSelect.innerHTML = '<option value="all">All subjects</option>';
            allSubjects.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s; opt.textContent = s;
                subjectSelect.appendChild(opt);
            });
        }
    }

    function getFilteredRows() {
        const rows = state.allRows;
        const teacherID = teacherSelect?.value || "all";
        const subj = subjectSelect?.value || "all";
        const assignments = state.teacherAssignments;

        return rows.filter(r => {
            if (subj !== "all" && r.subject !== subj) return false;
            if (teacherID === "all") return true;

            const ta = assignments[teacherID];
            if (!ta) return false;
            if (!ta.classes.has(r.class)) return false;
            if (!ta.subjects.has(r.subject)) return false;

            return true;
        });
    }

    function computePerformance(rows) {
        const assignments = state.teacherAssignments;
        const agg = {}; // teacher_id -> [grades]

        rows.forEach(r => {
            for (const [id, ta] of Object.entries(assignments)) {
                if (!ta.classes.has(r.class)) continue;
                if (!ta.subjects.has(r.subject)) continue;

                const val = Number(r.final_percent ?? r.final_5scale ?? NaN);
                if (Number.isNaN(val)) continue;

                if (!agg[id]) agg[id] = [];
                agg[id].push(val);
            }
        });

        return Object.entries(agg).map(([id, vals]) => ({
            teacher_id: id,
            teacher_name: assignments[id].name,
            avg: SBI.mean(vals),
            n: vals.length
        })).sort((a,b)=>(b.avg ?? 0)-(a.avg ?? 0));
    }

    function renderPerformance(perf) {
        if (!chartPerf) return;

        if (!perf.length) {
            Plotly.newPlot(chartPerf, [], {
                title: "No data (teachers)"
            });
            return;
        }

        Plotly.newPlot(chartPerf, [{
            x: perf.map(p => p.teacher_name),
            y: perf.map(p => p.avg),
            text: perf.map(p => `N=${p.n}`),
            type: "bar"
        }], {
            title: "Teacher performance (average grade)",
            xaxis: { title: "Teacher", automargin: true },
            yaxis: { title: "Average grade" }
        });
    }

    function computeTeacherSubjectStats(rows, teacherID) {
        const assignments = state.teacherAssignments;
        const agg = {}; // subject -> [grades]

        rows.forEach(r => {
            const ta = assignments[teacherID];
            if (!ta) return;
            if (!ta.classes.has(r.class)) return;
            if (!ta.subjects.has(r.subject)) return;

            const val = Number(r.final_percent ?? r.final_5scale ?? NaN);
            if (Number.isNaN(val)) return;

            if (!agg[r.subject]) agg[r.subject] = [];
            agg[r.subject].push(val);
        });

        return Object.entries(agg).map(([subj, vals]) => ({
            subject: subj,
            avg: SBI.mean(vals),
            n: vals.length
        }));
    }

    function renderTeacherSubjects(stats) {
        if (!chartSubjects) return;

        if (!stats.length) {
            Plotly.newPlot(chartSubjects, [], {
                title: "Select a teacher to see subject performance"
            });
            return;
        }

        Plotly.newPlot(chartSubjects, [{
            x: stats.map(s => s.subject),
            y: stats.map(s => s.avg),
            text: stats.map(s => `N=${s.n}`),
            mode: "markers",
            marker: {
                size: stats.map(s => Math.sqrt(s.n) * 8),
                sizemode: "area"
            }
        }], {
            title: "Teacher’s subjects: load & performance",
            xaxis: { title: "Subject" },
            yaxis: { title: "Average grade" }
        });
    }

    function computeTeacherTrend(rows, teacherID) {
        const assignments = state.teacherAssignments;
        const ta = assignments[teacherID];
        if (!ta) return [];

        const terms = state.allTerms;
        const byTerm = SBI.groupBy(
            rows.filter(r =>
                ta.classes.has(r.class) &&
                ta.subjects.has(r.subject)
            ),
            r => r.term,
            r => Number(r.final_percent ?? r.final_5scale ?? NaN)
        );

        return terms.map(t => ({
            term: t,
            avg: SBI.mean(byTerm[t] || [])
        }));
    }

    function renderTrend(trend, teacherName) {
        if (!chartTrend) return;

        const valid = trend.filter(p => p.avg !== null);
        if (!valid.length) {
            Plotly.newPlot(chartTrend, [], {
                title: "Select a teacher to see trend",
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
            title: `Trend across terms (${teacherName})`,
            xaxis: { title: "Term" },
            yaxis: { title: "Average grade" }
        });
    }

    function update() {
        const rows = getFilteredRows();
        SBI.log(`By Teacher → filtered rows: ${rows.length}`);

        const perf = computePerformance(rows);
        renderPerformance(perf);

        const teacherID = teacherSelect?.value || "all";
        if (!teacherID || teacherID === "all") {
            renderTeacherSubjects([]);
            renderTrend([], "");
            return;
        }

        const subjStats = computeTeacherSubjectStats(rows, teacherID);
        renderTeacherSubjects(subjStats);

        const trend = computeTeacherTrend(rows, teacherID);
        const name = state.teacherAssignments[teacherID]?.name || teacherID;
        renderTrend(trend, name);
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

SBI_Teacher.init();
