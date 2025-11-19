// dashboard_students.js - Анализ успеваемости учеников
console.log("DASHBOARD_STUDENTS.JS: Loaded");

window.SBI_Students = (function () {
    const SBI = window.SBI;

    let classSelect, termSelect, wrapper;

    function init() {
        classSelect = document.getElementById("studClassSelect");
        termSelect  = document.getElementById("studTermSelect");
        wrapper     = document.getElementById("studentsTableWrapper");

        if (classSelect) classSelect.addEventListener("change", renderTable);
        if (termSelect)  termSelect.addEventListener("change",  renderTable);
    }

    function onDataLoaded() {
        populateSelectors();
        renderTable();
    }

    function populateSelectors() {
        const state = SBI.state;
        if (!state) return;

        const terms   = state.allTerms || [];
        const classes = state.classesTable || [];

        // Сортируем четверти
        terms.sort();

        // Заполняем четверти
        termSelect.innerHTML = "";
        terms.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            termSelect.appendChild(opt);
        });

        // Заполняем классы (используем казахские названия)
        classSelect.innerHTML = "";
        const sortedClasses = classes
            .slice()
            .sort((a, b) => (a.class_id || "").localeCompare(b.class_id || "", undefined, { numeric: true }));

        sortedClasses.forEach(cls => {
            const opt = document.createElement("option");
            opt.value = cls.class_id;
            opt.textContent = cls.class_name || cls.class_id;
            classSelect.appendChild(opt);
        });

        // По умолчанию — первая четверть и первый класс
        if (terms.length) termSelect.value = terms[0];
        if (sortedClasses.length) classSelect.value = sortedClasses[0].class_id;
    }

    // Основная функция построения таблицы
    function renderTable() {
        if (!wrapper) return;

        const selectedClassId = classSelect ? classSelect.value : "";
        const selectedTerm    = termSelect  ? termSelect.value  : "";

        if (!selectedClassId || !selectedTerm) {
            wrapper.innerHTML = "<p style='padding:20px;color:#999;'>Выберите класс и четверть.</p>";
            return;
        }

        const rows = SBI.state.allRows || [];

        // Фильтруем строки аналитики по классу и четверти
        const filtered = rows.filter(r =>
            r.class_id === selectedClassId && r.term === selectedTerm
        );

        // Группируем по ученикам
        const byStudent = {};
        filtered.forEach(r => {
            const sid = r.student_id;
            if (!byStudent[sid]) {
                byStudent[sid] = {
                    student_id: sid,
                    student_name: r.student_name || sid,
                    grades: {}               // subject_id → final_5scale
                };
            }
            byStudent[sid].grades[r.subject_id] = r.final_5scale;
        });

        // Список всех предметов в выбранном классе/четверти (для колонок)
        const allSubjectIds = SBI.unique(filtered.map(r => r.subject_id));
        const subjectMap = SBI.state.idx_subjects || {};

        // Сортируем предметы по названию
        allSubjectIds.sort((a, b) => {
            const na = (subjectMap[a]?.subject_name || a);
            const nb = (subjectMap[b]?.subject_name || b);
            return na.localeCompare(nb);
        });

        // Шапка таблицы
        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th rowspan="2">ФИО ученика</th>
                        <th rowspan="2">ID</th>
                        ${allSubjectIds.map(sid => {
                            const name = subjectMap[sid]?.subject_name || sid;
                            return `<th style="min-width:80px;">${name}</th>`;
                        }).join("")}
                        <th rowspan="2">Средний балл</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Строки учеников (сортируем по фамилии)
        const students = Object.values(byStudent).sort((a, b) =>
            a.student_name.localeCompare(b.student_name)
        );

        students.forEach(stu => {
            const grades = stu.grades;
            const gradeValues = allSubjectIds.map(sid => grades[sid] ?? "-");

            // Средний балл только по имеющимся оценкам
            const nums = gradeValues.filter(g => typeof g === "number");
            const avg = nums.length ? (nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2) : "-";

            // Цвет среднего балла
            const avgColor = avg === "-" ? "" :
                parseFloat(avg) >= 4.5 ? "color:#2ecc71;" :
                parseFloat(avg) < 3.0 ? "color:#e74c3c;" : "";

            html += `
                <tr>
                    <td style="text-align:left; font-weight:500;">${stu.student_name}</td>
                    <td style="font-size:0.85em; color:#777;">${stu.student_id}</td>
                    ${gradeValues.map(g => {
                        if (g === "-") return `<td style="color:#ccc;">-</td>`;
                        const color = g === 5 ? "#2ecc71" : g === 4 ? "#3498db" : g === 3 ? "#f1c40f" : "#e74c3c";
                        return `<td style="font-weight:bold; color:${color};">${g}</td>`;
                    }).join("")}
                    <td style="font-weight:bold; ${avgColor}">${avg}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            <div style="margin-top:10px; font-size:0.85rem; color:#666;">
                * Оценки по 5-балльной шкале. «-» — нет оценки по предмету в выбранной четверти.
            </div>
        `;

        wrapper.innerHTML = html;
    }

    document.addEventListener("DOMContentLoaded", init);

    return {
        onDataLoaded: onDataLoaded
    };
})();
