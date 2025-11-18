// dashboard_class.js
console.log("dashboard_class.js загружен");

window.SBI_Class = (function () {
    const state = SBI.state;

    let termSelect;
    let classSelect;

    let summaryContainer;
    let pieContainer;
    let trendContainer;
    let heatmapContainer;

    function buildTeacherName(row) {
        if (!row) return "";
        const parts = [
            row.last_name   != null ? String(row.last_name).trim()   : "",
            row.first_name  != null ? String(row.first_name).trim()  : "",
            row.middle_name != null ? String(row.middle_name).trim() : ""
        ].filter(Boolean);
        return parts.join(" ");
    }

    function getHomeroomTeacherName(classRow, teachersIndex) {
        if (!classRow) return "";
        const tid = String(classRow.homeroom_teacher_id || "").trim();
        if (!tid) return "";
        const tr = teachersIndex[tid];
        return buildTeacherName(tr) || tid;
    }

    function getClassLabelFromRow(cls) {
        return String(cls.class_name || cls.class_id || "").trim();
    }

    // категоризация учащихся по подмножеству строк
    function classifyStudents(rows) {
        const byStudent = SBI.groupBy(
            rows,
            r => r.student_id,
            r => SBI.toNumber(r.final_5scale)
        );

        let excellent = 0;
        let good      = 0;
        let three     = 0;
        let two       = 0;

        Object.keys(byStudent).forEach(sid => {
            const grades = byStudent[sid].filter(g => g != null && !Number.isNaN(g));
            if (!grades.length) return;

            const has2 = grades.some(g => g === 2);
            const has3 = grades.some(g => g === 3);
            const has4 = grades.some(g => g === 4);
            const has5 = grades.some(g => g === 5);
            const all5 = grades.every(g => g === 5);

            if (has2) {
                two++;
            } else if (has3) {
                three++;
            } else if (all5) {
                excellent++;
            } else if (has4 || has5) {
                good++;
            }
        });

        return { excellent, good, three, two };
    }

    // Качество знаний по классу = (отличники + хорошисты) / всех
    function computeQuality(rows) {
        const { excellent, good, three, two } = classifyStudents(rows);
        const total = excellent + good + three + two;
        if (!total) return null;
        return (excellent + good) / total;
    }

    // ───────────── верхняя таблица по всем классам ─────────────

    function renderClassSummaryTable() {
        if (!summaryContainer) return;

        const rows = state.allRows || [];
        if (!rows.length) {
            summaryContainer.innerHTML = "<p>Нет данных для отображения по классам.</p>";
            return;
        }

        const classes  = state.classesTable || [];
        const teachers = state.teachers || [];
        const rawTerms = state.allTerms || [];
        const terms    = rawTerms.map(t => String(t).trim());

        const teachersIndex = {};
        teachers.forEach(t => {
            const id = String(t.teacher_id || "").trim();
            if (id) teachersIndex[id] = t;
        });

        const byClassTerm = {};
        rows.forEach(r => {
            const label = String(r.class || r.class_id || "").trim();
            const tid   = String(r.term_id || r.term || "").trim();
            if (!label || !tid) return;
            const key = label + "|" + tid;
            if (!byClassTerm[key]) byClassTerm[key] = [];
            byClassTerm[key].push(r);
        });

        let html = `
            <h3>Качество знаний по всем классам</h3>
            <table class="simple-table">
                <thead>
                    <tr>
                        <th>Класс</th>
                        <th>Классный руководитель</th>
        `;
        terms.forEach(t => {
            html += `<th>${t}</th>`;
        });
        html += `
                    </tr>
                </thead>
                <tbody>
        `;

        const sortedClasses = [...classes].sort((a, b) => {
            const an = getClassLabelFromRow(a);
            const bn = getClassLabelFromRow(b);
            return an.localeCompare(bn, "ru");
        });

        sortedClasses.forEach(cls => {
            const label = getClassLabelFromRow(cls);
            if (!label) return;

            const homeroomName = getHomeroomTeacherName(cls, teachersIndex);

            html += `
                <tr>
                    <td>${label}</td>
                    <td>${homeroomName || ""}</td>
            `;

            terms.forEach(rawTid => {
                const tid = String(rawTid).trim();
                const key = label + "|" + tid;
                const subset = byClassTerm[key] || [];

                if (!subset.length) {
                    html += `<td>n/a</td>`;
                } else {
                    const q = computeQuality(subset);
                    html += q == null
                        ? `<td>n/a</td>`
                        : `<td>${Math.round(q * 100)}%</td>`;
                }
            });

            html += "</tr>";
        });

        html += `
                </tbody>
            </table>
        `;

        summaryContainer.innerHTML = html;
    }

    // ───────────── donut по выбранному классу ─────────────

    function getClassNameByLabel(label) {
        const classes = state.classesTable || [];
        const found = classes.find(c =>
            getClassLabelFromRow(c) === String(label).trim()
        );
        if (found) return getClassLabelFromRow(found);
        return label;
    }

    function renderClassPie() {
        if (!pieContainer) return;

        const allRows = state.allRows || [];
        if (!allRows.length) {
            pieContainer.innerHTML = "<p>Нет данных для выбранных параметров.</p>";
            return;
        }

        const term    = termSelect  && termSelect.value  ? termSelect.value  : null;
        const classLb = classSelect && classSelect.value ? classSelect.value : null;

        if (!term || !classLb) {
            pieContainer.innerHTML = "<p>Выберите четверть и класс.</p>";
            return;
        }

        const rows = allRows.filter(r =>
            String(r.term_id || r.term || "").trim() === String(term).trim() &&
            String(r.class    || r.class_id || "").trim() === String(classLb).trim()
        );

        if (!rows.length) {
            pieContainer.innerHTML = "<p>Для этого класса и четверти пока нет итоговых оценок.</p>";
            return;
        }

        const { excellent, good, three, two } = classifyStudents(rows);

        const labels = [
            "Отличники (только 5)",
            "Хорошисты (4–5, без 3 и 2)",
            "Троечники (есть 3, нет 2)",
            "Двоечники (есть 2)"
        ];
        const values = [excellent, good, three, two];
        const total  = values.reduce((a, b) => a + b, 0);

        Plotly.newPlot(pieContainer, [{
            labels,
            values,
            type: "pie",
            hole: 0.5,
            sort: false,
            direction: "clockwise",
            marker: {
                colors: ["#2ecc71", "#3498db", "#f1c40f", "#e74c3c"]
            },
            textinfo: "percent",
            textposition: "inside",
            textfont: { size: 12 },
            hovertemplate: "%{label}<br>Уч-ся: %{value} (%{percent})<extra></extra>"
        }], {
            title: `Структура успеваемости — ${getClassNameByLabel(classLb)} (${term})`,
            showlegend: true,
            legend: {
                orientation: "h",
                y: -0.1,
                x: 0.5,
                xanchor: "center"
            },
            margin: { t: 50, b: 70, l: 0, r: 0 },
            annotations: total ? [{
                showarrow: false,
                text: `Всего<br>${total}`,
                x: 0.5,
                y: 0.5,
                font: { size: 13 }
            }] : []
        });
    }

    // ───────────── инициализация ─────────────

    function initDom() {
        termSelect       = document.getElementById("classTermSelect");
        classSelect      = document.getElementById("classClassSelect");
        summaryContainer = document.getElementById("chart-class-avg");
        pieContainer     = document.getElementById("chart-class-dist");
        trendContainer   = document.getElementById("chart-class-trend");
        heatmapContainer = document.getElementById("chart-class-heatmap");

        if (termSelect)  termSelect.addEventListener("change", renderClassPie);
        if (classSelect) classSelect.addEventListener("change", renderClassPie);
    }

    function onDataLoaded() {
        const rows = state.allRows || [];
        if (!rows.length) {
            SBI.log("По классам: нет данных для отображения.");
            return;
        }

        // четверти
        if (termSelect) {
            termSelect.innerHTML = "";
            (state.allTerms || []).forEach(t => {
                const tidy = String(t).trim();
                const opt = document.createElement("option");
                opt.value = tidy;
                opt.textContent = tidy;
                termSelect.appendChild(opt);
            });
            if (state.allTerms.length) {
                termSelect.value = String(state.allTerms[state.allTerms.length - 1]).trim();
            }
        }

        // классы
        if (classSelect) {
            classSelect.innerHTML = "";
            const classes = state.classesTable || [];
            const sortedClasses = [...classes].sort((a, b) => {
                const an = getClassLabelFromRow(a);
                const bn = getClassLabelFromRow(b);
                return an.localeCompare(bn, "ru");
            });

            sortedClasses.forEach(cls => {
                const label = getClassLabelFromRow(cls);
                if (!label) return;
                const opt = document.createElement("option");
                opt.value = label;
                opt.textContent = label;
                classSelect.appendChild(opt);
            });
        }

        renderClassSummaryTable();
        renderClassPie();

        if (trendContainer) {
            trendContainer.innerHTML =
                "<p style='font-size:13px;color:#666;'>Здесь позже можно добавить график динамики по классам.</p>";
        }
        if (heatmapContainer) {
            heatmapContainer.innerHTML = "";
        }
    }

    initDom();

    return {
        onDataLoaded
    };
})();
