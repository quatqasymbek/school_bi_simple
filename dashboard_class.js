// dashboard_class.js
console.log("dashboard_class.js загружен");

window.SBI_Class = (function () {
    const state = SBI.state;

    let termSelect;
    let classSelect;

    let summaryContainer;   // верхняя таблица по всем классам
    let pieContainer;       // круговая диаграмма
    let trendContainer;     // пока не используем (можно для будущих графиков)
    let heatmapContainer;   // пока не используем

    // ------------------------------------------
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ------------------------------------------

    function buildTeacherName(row) {
        if (!row) return "";
        const parts = [
            row.last_name  != null ? String(row.last_name).trim()  : "",
            row.first_name != null ? String(row.first_name).trim() : "",
            row.middle_name!= null ? String(row.middle_name).trim(): ""
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

    // Категоризация учащихся по классу и четверти
    function classifyStudents(rows) {
        const byStudent = SBI.groupBy(
            rows,
            r => r.student_id,
            r => Number(r.final_5scale)
        );

        let excellent = 0; // только 5
        let good = 0;      // 4–5, без 3 и 2
        let three = 0;     // есть 3, но нет 2
        let two = 0;       // есть 2

        Object.keys(byStudent).forEach(sid => {
            const grades = byStudent[sid].filter(g => !Number.isNaN(g));
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

    // Качество знаний для поднабора строк:
    // доля учеников, у которых НЕТ 2–3 (только отличники + хорошисты)
    function computeQuality(rows) {
        const { excellent, good, three, two } = classifyStudents(rows);
        const total = excellent + good + three + two;
        if (!total) return null;
        return (excellent + good) / total; // 0..1
    }

    // ------------------------------------------
    // ВЕРХНЯЯ ТАБЛИЦА ПО ВСЕМ КЛАССАМ
    // ------------------------------------------

    function renderClassSummaryTable() {
        if (!summaryContainer) return;

        const rows = state.allRows || [];
        if (!rows.length) {
            summaryContainer.innerHTML = "<p>Нет данных для отображения по классам.</p>";
            return;
        }

        const classes  = state.classesTable || [];
        const teachers = state.teachers || [];
        const terms    = state.allTerms || [];

        // Индекс учителей по id
        const teachersIndex = {};
        teachers.forEach(t => {
            const id = String(t.teacher_id || "").trim();
            if (!id) return;
            teachersIndex[id] = t;
        });

        // Для быстрого фильтра: группируем по (класс, четверть)
        // КЛЮЧ = "label|term", где label = человекопонятное название класса
        const byClassTerm = {};
        rows.forEach(r => {
            const label = String(r.class || r.class_id || "").trim();
            const tid   = String(r.term_id || r.term || "").trim();
            if (!label || !tid) return;
            const key = label + "|" + tid;
            if (!byClassTerm[key]) byClassTerm[key] = [];
            byClassTerm[key].push(r);
        });

        // Строим таблицу
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

        // сортируем классы по названию (1 «А» … 11 «Б»)
        const sortedClasses = [...classes].sort((a, b) => {
            const an = String(a.class_name || a.class_id || "");
            const bn = String(b.class_name || b.class_id || "");
            return an.localeCompare(bn, "ru");
        });

        sortedClasses.forEach(cls => {
            const label = String(cls.class_name || cls.class_id || "").trim();
            if (!label) return;

            const className     = label;
            const homeroomName  = getHomeroomTeacherName(cls, teachersIndex);

            html += `
                <tr>
                    <td>${className}</td>
                    <td>${homeroomName || ""}</td>
            `;

            terms.forEach(tid => {
                const key = label + "|" + tid;
                const subset = byClassTerm[key] || [];
                if (!subset.length) {
                    html += `<td>n/a</td>`;
                } else {
                    const q = computeQuality(subset);
                    if (q == null) {
                        html += `<td>n/a</td>`;
                    } else {
                        html += `<td>${Math.round(q * 100)}%</td>`;
                    }
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

    // ------------------------------------------
    // КРУГОВАЯ ДИАГРАММА ПО ВЫБРАННОМУ КЛАССУ
    // ------------------------------------------

    function renderClassPie() {
        if (!pieContainer) return;

        const allRows = state.allRows || [];
        if (!allRows.length) {
            pieContainer.innerHTML = "<p>Нет данных для выбранных параметров.</p>";
            return;
        }

        const term    = termSelect  && termSelect.value  ? termSelect.value  : null;
        const classId = classSelect && classSelect.value ? classSelect.value : null;

        if (!term || !classId) {
            pieContainer.innerHTML = "<p>Выберите четверть и класс.</p>";
            return;
        }

        const subset = allRows.filter(r =>
            String(r.term_id || r.term || "").trim() === String(term).trim() &&
            String(r.class || r.class_id || "").trim() === String(classId).trim()
        );

        if (!subset.length) {
            pieContainer.innerHTML = "<p>Для этого класса и четверти пока нет итоговых оценок.</p>";
            return;
        }

        const { excellent, good, three, two } = classifyStudents(subset);

        const labels = [
            "Отличники (только 5)",
            "Хорошисты (4–5, без 3 и 2)",
            "Троечники (есть 3, нет 2)",
            "Двоечники (есть 2)"
        ];
        const values = [excellent, good, three, two];

        Plotly.newPlot(pieContainer, [{
            labels,
            values,
            type: "pie",
            textinfo: "label+percent",
            hole: 0.35
        }], {
            title: `Структура успеваемости — класс ${getClassNameById(classId)} (${term})`,
            legend: { orientation: "h", y: -0.1 }
        });
    }

    function getClassNameById(classId) {
        const cls = (state.classesTable || []).find(c =>
            String(c.class_id || "").trim() === String(classId).trim() ||
            String(c.class_name || "").trim() === String(classId).trim()
        );
        if (cls) return cls.class_name || cls.class_id || classId;
        return classId;
    }

    // ------------------------------------------
    // ИНИЦИАЛИЗАЦИЯ И ПОДПИСКА НА ДАННЫЕ
    // ------------------------------------------

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

        // заполняем селектор четвертей
        if (termSelect) {
            termSelect.innerHTML = "";
            (state.allTerms || []).forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                termSelect.appendChild(opt);
            });
            if (state.allTerms.length) {
                termSelect.value = state.allTerms[state.allTerms.length - 1];
            }
        }

        // селектор классов — значение = человекопонятное название класса
        if (classSelect) {
            classSelect.innerHTML = "";
            const classes = state.classesTable || [];
            const sortedClasses = [...classes].sort((a, b) => {
                const an = String(a.class_name || a.class_id || "");
                const bn = String(b.class_name || b.class_id || "");
                return an.localeCompare(bn, "ru");
            });

            sortedClasses.forEach(cls => {
                const label = String(cls.class_name || cls.class_id || "").trim();
                if (!label) return;
                const opt = document.createElement("option");
                opt.value = label;
                opt.textContent = label;
                classSelect.appendChild(opt);
            });
        }

        // верхняя таблица
        renderClassSummaryTable();

        // круговая диаграмма
        renderClassPie();

        // очистим лишние блоки (можно использовать в будущем)
        if (trendContainer) {
            trendContainer.innerHTML =
                "<p style='font-size:13px;color:#666;'>Здесь позже можно добавить график динамики по классам.</p>";
        }
        if (heatmapContainer) {
            heatmapContainer.innerHTML = "";
        }
    }

    // сразу инициализируем DOM-ссылки
    initDom();

    return {
        onDataLoaded
    };
})();
