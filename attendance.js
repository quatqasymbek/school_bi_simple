// attendance.js
console.log("attendance.js загружен");

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
        termDetailSelect  = document.getElementById("attTermDetail");
        classDetailSelect = document.getElementById("attClassDetail");

        if (termSummarySelect) termSummarySelect.onchange = renderSummary;
        if (termDetailSelect)  termDetailSelect.onchange  = renderDetail;
        if (classDetailSelect) classDetailSelect.onchange = renderDetail;
    }

    function fillSelect(select, values) {
        if (!select) return;
        select.innerHTML = "";
        values.forEach(function (v) {
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
        return String(cls).replace(/^K-/, "");
    }

    // 1) Сводка по классам
    function computeClassSummary(rows, termFilter) {
        const filtered = rows.filter(function (r) {
            const t = getTermValue(r);
            return !termFilter || t === termFilter;
        });

        const groups = SBI.groupBy(filtered, function (r) {
            return getClassValue(r);
        }, function (r) { return r; });

        const result = Object.keys(groups).map(function (clsId) {
            const list = groups[clsId];

            const ratiosPresent = [];
            const ratiosAbsent = [];
            const ratiosLate = [];
            let totalLessonsSum = 0;

            list.forEach(function (r) {
                const total = Number(r.total_classes ?? 0);
                const present = Number(r.present_classes ?? 0);
                const exc = Number(r.absent_excused_classes ?? 0);
                const unexc = Number(r.absent_unexc_classes ?? 0);
                const late = Number(r.late_classes ?? 0);

                const denom = total || (present + exc + unexc + late);
                if (!denom) return;

                totalLessonsSum += total || denom;
                ratiosPresent.push(present / denom);
                ratiosAbsent.push((exc + unexc) / denom);
                ratiosLate.push(late / denom);
            });

            const presentPct = (SBI.mean(ratiosPresent) || 0) * 100;
            const absentPct  = (SBI.mean(ratiosAbsent)  || 0) * 100;
            const latePct    = (SBI.mean(ratiosLate)    || 0) * 100;

            return {
                classId: clsId,
                totalClasses: totalLessonsSum,
                presentPct: presentPct,
                absentPct: absentPct,
                latePct: latePct
            };
        }).filter(function (r) {
            return r.classId;
        }).sort(function (a, b) {
            return b.presentPct - a.presentPct;
        });

        return result;
    }

    function renderSummary() {
        if (!summaryWrapper) return;
        const rows = state.attendanceRows || [];

        if (!rows.length) {
            summaryWrapper.innerHTML = "<p>В файле Excel нет листа «Посещаемость» или он пустой.</p>";
            return;
        }

        const term = termSummarySelect ? termSummarySelect.value : "";
        const summary = computeClassSummary(rows, term);

        const table = document.createElement("table");
        table.className = "simple-table";

        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Класс</th>
                <th>Всего уроков</th>
                <th>% присутствий</th>
                <th>% отсутствий</th>
                <th>% опозданий</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        summary.forEach(function (row) {
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

        summaryWrapper.innerHTML = "";
        summaryWrapper.appendChild(table);
    }

    // 2) Детализация по ученикам
    function computeStudentDetails(rows, classFilter, termFilter) {
        const filtered = rows.filter(function (r) {
            const cls = getClassValue(r);
            const t   = getTermValue(r);
            if (classFilter && cls !== classFilter) return false;
            if (termFilter  && t   !== termFilter)  return false;
            return true;
        });

        const byStudent = SBI.groupBy(filtered, function (r) {
            return r.student_id || "";
        }, function (r) { return r; });

        const result = Object.keys(byStudent).map(function (sid) {
            const list = byStudent[sid];
            let total = 0;
            let present = 0;
            let exc = 0;
            let unexc = 0;
            let late = 0;

            list.forEach(function (r) {
                const t = Number(r.total_classes ?? 0);
                const p = Number(r.present_classes ?? 0);
                const e = Number(r.absent_excused_classes ?? 0);
                const u = Number(r.absent_unexcused_classes ?? 0);
                const l = Number(r.late_classes ?? 0);

                const denom = t || (p + e + u + l);

                total   += t || denom;
                present += p;
                exc     += e;
                unexc   += u;
                late    += l;
            });

            const name = (list[0] && list[0].student_name || "").trim();

            return {
                studentId: sid,
                studentName: name || sid,
                total: total,
                present: present,
                late: late,
                exc: exc,
                unexc: unexc
            };
        }).filter(function (r) {
            return r.studentId;
        }).sort(function (a, b) {
            return b.present - a.present;
        });

        return result;
    }

    function renderDetail() {
        if (!detailWrapper) return;
        const rows = state.attendanceRows || [];

        if (!rows.length) {
            detailWrapper.innerHTML = "<p>Нет данных о посещаемости.</p>";
            return;
        }

        const cls  = classDetailSelect ? classDetailSelect.value : "";
        const term = termDetailSelect  ? termDetailSelect.value  : "";

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
                <th>Всего уроков</th>
                <th>Присутствий</th>
                <th>Опозданий</th>
                <th>Пропуски (уваж.)</th>
                <th>Пропуски (неуваж.)</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        details.forEach(function (row) {
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
        detailWrapper.innerHTML = "";
        detailWrapper.appendChild(table);
    }

    function onDataLoaded() {
        const rows = state.attendanceRows || [];
        if (!rows.length) {
            const container = document.getElementById("chart-attendance-total");
            if (container) {
                container.innerHTML = "<p>В файле Excel нет листа «Посещаемость» или он пустой.</p>";
            }
            SBI.log("Дашборд посещаемости: нет данных.");
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
            termSummarySelect.value = terms[0];
            termDetailSelect.value  = terms[0];
        }
        if (classes.length) {
            classDetailSelect.value = classes[0];
        }

        renderSummary();
        renderDetail();
    }

    init();

    return {
        onDataLoaded: onDataLoaded
    };
})();
