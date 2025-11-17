// attendance.js
console.log("attendance.js loaded");

window.SBI_Attendance = (function () {
    const state = SBI.state;

    let summaryWrapper;
    let detailWrapper;
    let termSummarySelect;
    let termDetailSelect;
    let classDetailSelect;

    function init() {
        summaryWrapper = document.getElementById("attSummaryTableWrapper") ||
            document.getElementById("chart-attendance-total");
        detailWrapper = document.getElementById("attDetailTableWrapper") ||
            document.getElementById("chart-attendance-class");

        termSummarySelect = document.getElementById("attTermSummary");
        termDetailSelect = document.getElementById("attTermDetail");
        classDetailSelect = document.getElementById("attClassDetail");

        if (termSummarySelect) termSummarySelect.addEventListener("change", renderSummary);
        if (termDetailSelect) termDetailSelect.addEventListener("change", renderDetail);
        if (classDetailSelect) classDetailSelect.addEventListener("change", renderDetail);
    }

    function fillSelect(select, values, withAllLabel) {
        if (!select) return;
        select.innerHTML = "";
        if (withAllLabel) {
            const optAll = document.createElement("option");
            optAll.value = "all";
            optAll.textContent = withAllLabel;
            select.appendChild(optAll);
        }
        values.forEach(v => {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = v;
            select.appendChild(opt);
        });
    }

    function getTermValue(row) {
        return row.term_id || row.term || "";
    }

    function getClassValue(row) {
        return row.class_id || row.class || "";
    }

    function formatClassLabel(cls) {
        if (!cls) return "";
        return String(cls).replace(/^K-/, ""); // K-7AE -> 7AE
    }

    /* ------------ 1) SUMMARY (BY CLASS) ------------ */

    function computeClassSummary(rows, termFilter) {
        const filtered = rows.filter(r => {
            const t = getTermValue(r);
            return !termFilter || termFilter === "all" || t === termFilter;
        });

        const groups = SBI.groupBy(
            filtered,
            r => getClassValue(r),
            r => r
        );

        const result = Object.entries(groups).map(([cls, list]) => {
            let totalLessonsSum = 0;
            const presentRatio = [];
            const absentRatio = [];
            const lateRatio = [];

            list.forEach(r => {
                const total = Number(r.total_classes ?? 0);
                const present = Number(r.present_classes ?? 0);
                const exc = Number(r.absent_excused_classes ?? 0);
                const unexc = Number(r.absent_unexcused_classes ?? 0);
                const late = Number(r.late_classes ?? 0);

                const denom = total || (present + exc + unexc + late);
                if (!denom) return;

                totalLessonsSum += total || denom;

                presentRatio.push(present / denom);
                absentRatio.push((exc + unexc) / denom);
                lateRatio.push(late / denom);
            });

            const presentPct = (SBI.mean(presentRatio) || 0) * 100;
            const absentPct = (SBI.mean(absentRatio) || 0) * 100;
            const latePct = (SBI.mean(lateRatio) || 0) * 100;

            return {
                classId: cls,
                totalClasses: totalLessonsSum,
                presentPct,
                absentPct,
                latePct
            };
        }).filter(r => r.classId).sort((a, b) => b.presentPct - a.presentPct);

        return result;
    }

    function renderSummary() {
        if (!summaryWrapper) return;
        const rows = state.attendanceRows || [];
        summaryWrapper.innerHTML = "";

        if (!rows.length) {
            summaryWrapper.innerHTML = "<p>Нет данных о посещаемости.</p>";
            return;
        }

        const term = termSummarySelect?.value || null;
        const summary = computeClassSummary(rows, term);

        const table = document.createElement("table");
        table.className = "simple-table";

        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Класс</th>
                <th>Всего занятий</th>
                <th>% присутствий</th>
                <th>% отсутствий</th>
                <th>% опозданий</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        summary.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${formatClassLabel(row.classId)}</td>
                <td>${row.totalClasses}</td>
                <td>${row.presentPct.toFixed(1)}%</td>
                <td>${row.absentPct.toFixed(1)}%</td>
                <td>${row.latePct.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        summaryWrapper.appendChild(table);
    }

    /* ------------ 2) DETAILS (BY STUDENT) ------------ */

    function computeStudentDetails(rows, classFilter, termFilter) {
        const filtered = rows.filter(r => {
            const cls = getClassValue(r);
            const t = getTermValue(r);
            return (!classFilter || cls === classFilter) &&
                   (!termFilter || t === termFilter);
        });

        const byStudent = SBI.groupBy(
            filtered,
            r => r.student_id || "",
            r => r
        );

        const result = Object.entries(byStudent).map(([sid, list]) => {
            let total = 0;
            let present = 0;
            let exc = 0;
            let unexc = 0;
            let late = 0;

            list.forEach(r => {
                const t = Number(r.total_classes ?? 0);
                const p = Number(r.present_classes ?? 0);
                const e = Number(r.absent_excused_classes ?? 0);
                const u = Number(r.absent_unexcused_classes ?? 0);
                const l = Number(r.late_classes ?? 0);

                const denom = t || (p + e + u + l);

                total += t || denom;
                present += p;
                exc += e;
                unexc += u;
                late += l;
            });

            const name = (list[0]?.student_name || "").trim();

            return {
                studentId: sid,
                studentName: name || sid,
                total,
                present,
                late,
                exc,
                unexc
            };
        }).filter(r => r.studentId).sort((a, b) => b.present - a.present); // sort by present desc

        return result;
    }

    function renderDetail() {
        if (!detailWrapper) return;
        const rows = state.attendanceRows || [];
        detailWrapper.innerHTML = "";

        if (!rows.length) {
            detailWrapper.innerHTML = "<p>Нет данных о посещаемости.</p>";
            return;
        }

        const cls = classDetailSelect?.value || "";
        const term = termDetailSelect?.value || "";

        if (!cls || !term) {
            detailWrapper.innerHTML = "<p>Выберите класс и четверть.</p>";
            return;
        }

        const details = computeStudentDetails(rows, cls, term);

        const table = document.createElement("table");
        table.className = "simple-table";

        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Ученик</th>
                <th>Всего занятий</th>
                <th>Присутствий</th>
                <th>Опозданий</th>
                <th>Пропуски (уваж.)</th>
                <th>Пропуски (неуваж.)</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        details.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.studentName}</td>
                <td>${row.total}</td>
                <td>${row.present}</td>
                <td>${row.late}</td>
                <td>${row.exc}</td>
                <td>${row.unexc}</td>
            `;
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        detailWrapper.appendChild(table);
    }

    /* ------------ PUBLIC HOOK ------------ */

    function onDataLoaded() {
        const rows = state.attendanceRows || [];

        if (!rows.length) {
            const container = document.getElementById("chart-attendance-total");
            if (container) {
                container.innerHTML = "<p>В файле Excel нет листа «Посещаемость» или он пустой.</p>";
            }
            SBI.log("Attendance dashboard: no data.");
            return;
        }

        const terms = SBI.unique(rows.map(getTermValue));
        const classes = SBI.unique(rows.map(getClassValue));
        state.attendanceTerms = terms;
        state.attendanceClasses = classes;

        fillSelect(termSummarySelect, terms);
        fillSelect(termDetailSelect, terms);
        fillSelect(classDetailSelect, classes);

        if (terms.length) {
            if (termSummarySelect) termSummarySelect.value = terms[0];
            if (termDetailSelect) termDetailSelect.value = terms[0];
        }
        if (classes.length && classDetailSelect) {
            classDetailSelect.value = classes[0];
        }

        renderSummary();
        renderDetail();
    }

    return {
        init,
        onDataLoaded
    };
})();

SBI_Attendance.init();
