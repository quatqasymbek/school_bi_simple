// dashboard_teacher.js
console.log("dashboard_teacher.js loaded");

window.SBI_Teacher = (function () {
    const state = SBI.state;

    let teacherSelect, subjectSelect;
    let chartPerf, chartLoad, chartTrend;

    function init() {
        teacherSelect  = document.getElementById("teacherSelect");
        subjectSelect  = document.getElementById("teacherSubjectSelect");
        chartPerf      = document.getElementById("chart-teacher-performance");
        chartLoad      = document.getElementById("chart-teacher-subjects");
        chartTrend     = document.getElementById("chart-teacher-trend");

        if (teacherSelect) teacherSelect.addEventListener("change", onTeacherChange);
        if (subjectSelect) subjectSelect.addEventListener("change", update);
    }

    /* -----------------------------
       Helpers for dropdowns
    ------------------------------*/

    function populateTeacherList() {
        if (!teacherSelect) return;
        const teachers = state.allTeachers || [];

        teacherSelect.innerHTML = "";
        teachers.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.teacher_id;
            opt.textContent = t.teacher_name;
            teacherSelect.appendChild(opt);
        });
    }

    function subjectsForTeacher(teacherId) {
        const assignments = state.assignments || state.teacherAssignments || [];
        const idxSubj = state.idx_subjects || {};

        const subjSet = new Set();

        assignments.forEach(a => {
            if (String(a.teacher_id || "").trim() !== teacherId) return;

            const sid = String(a.subject_id || "").trim();
            if (!sid) return;

            const subjRow = idxSubj[sid] || {};
            const name = String(subjRow.subject_name || subjRow.name || sid).trim();

            subjSet.add(JSON.stringify({ sid, name }));
        });

        return Array.from(subjSet).map(s => JSON.parse(s));
    }

    function populateSubjectList(teacherId) {
        if (!subjectSelect) return;

        const subjects = subjectsForTeacher(teacherId);
        subjectSelect.innerHTML = "";

        subjects.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.sid;
            opt.textContent = s.name;
            subjectSelect.appendChild(opt);
        });
    }

    /* -----------------------------
       Data filtering
    ------------------------------*/

    function filterRowsForTeacher(teacherId, subjectId) {
        const rows = state.allRows || [];
        const assignments = state.assignments || state.teacherAssignments || [];

        // Build quick lookup set of (subject_id|class_id|term_id) for this teacher
        const keySet = new Set();
        assignments.forEach(a => {
            if (String(a.teacher_id || "").trim() !== teacherId) return;

            const sid = String(a.subject_id || "").trim();
            const cid = String(a.class_id   || "").trim();
            const tid = String(a.term_id    || "").trim();
            if (!sid || !cid || !tid) return;

            keySet.add(`${sid}|${cid}|${tid}`);
        });

        if (!keySet.size) return [];

        return rows.filter(r => {
            const sid = String(r.subject_id || "").trim();
            const cid = String(r.class_id   || "").trim();
            const tid = String(r.term_id    || "").trim();
            if (!sid || !cid || !tid) return false;

            if (subjectId && sid !== subjectId) return false;

            const key = `${sid}|${cid}|${tid}`;
            return keySet.has(key);
        });
    }

    /* -----------------------------
       Render functions
    ------------------------------*/

    function renderPerformanceBox(rows, teacherName, subjectName) {
        if (!chartPerf) return;

        if (!rows.length) {
            Plotly.newPlot(chartPerf, [], {
                title: "No data for this teacher / subject",
                xaxis: { title: "Term" },
                yaxis: { title: "Final percent" }
            });
            return;
        }

        const yVals = rows
            .map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
            .filter(v => !Number.isNaN(v));

        Plotly.newPlot(chartPerf, [{
            x: rows.map(r => r.term),
            y: yVals,
            type: "box"
        }], {
            title: `${teacherName} — Performance (${subjectName})`,
            xaxis: { title: "Term" },
            yaxis: { title: "Grade" }
        });
    }

    function renderLoadChart(rows) {
        if (!chartLoad) return;

        if (!rows.length) {
            Plotly.newPlot(chartLoad, [], {
                title: "No classes for this teacher / subject",
                xaxis: { title: "Class" },
                yaxis: { title: "Number of student-term records" }
            });
            return;
        }

        const counts = {};
        rows.forEach(r => {
            const cls = r.class;
            if (!counts[cls]) counts[cls] = 0;
            counts[cls]++;
        });

        Plotly.newPlot(chartLoad, [{
            x: Object.keys(counts),
            y: Object.values(counts),
            type: "bar"
        }], {
            title: "Class load (how many student×term results)",
            xaxis: { title: "Class" },
            yaxis: { title: "Count" }
        });
    }

    function renderTrendChart(rows) {
        if (!chartTrend) return;

        if (!rows.length) {
            Plotly.newPlot(chartTrend, [], {
                title: "No trend data",
                xaxis: { title: "Term" },
                yaxis: { title: "Average grade" }
            });
            return;
        }

        const byTerm = SBI.groupBy(
            rows,
            r => r.term,
            r => Number(r.final_percent ?? r.final_5scale ?? NaN)
        );

        const terms = Object.keys(byTerm);
        const avg = terms.map(t => SBI.mean(byTerm[t]));

        Plotly.newPlot(chartTrend, [{
            x: terms,
            y: avg,
            mode: "lines+markers"
        }], {
            title: "Average grade trend for this teacher / subject",
            xaxis: { title: "Term" },
            yaxis: { title: "Average grade" }
        });
    }

    /* -----------------------------
       Controller
    ------------------------------*/

    function onTeacherChange() {
        const teacherId = teacherSelect?.value;
        if (!teacherId) return;

        populateSubjectList(teacherId);
        update();
    }

    function update() {
        if (!teacherSelect || !subjectSelect) return;

        const teacherId = teacherSelect.value;
        if (!teacherId) return;

        const teacher = (state.allTeachers || []).find(t => t.teacher_id === teacherId);
        const teacherName = teacher ? teacher.teacher_name : teacherId;

        const subjectId = subjectSelect.value;
        const subjList = subjectsForTeacher(teacherId);
        const subjObj = subjList.find(s => s.sid === subjectId);
        const subjectName = subjObj ? subjObj.name : subjectId;

        const rows = filterRowsForTeacher(teacherId, subjectId);
        SBI.log(`By Teacher → rows for ${teacherName}, ${subjectName}: ${rows.length}`);

        renderPerformanceBox(rows, teacherName, subjectName);
        renderLoadChart(rows);
        renderTrendChart(rows);
    }

    function onDataLoaded() {
        if (!state.allRows.length) {
            SBI.log("Teacher dashboard: no data yet.");
            return;
        }
        populateTeacherList();

        if (teacherSelect && teacherSelect.options.length) {
            teacherSelect.selectedIndex = 0;
            onTeacherChange();
        }
    }

    return {
        init,
        onDataLoaded,
        update
    };
})();

SBI_Teacher.init();
