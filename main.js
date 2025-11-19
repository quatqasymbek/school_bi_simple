// ==========================================================
//               MAIN.JS — ФИНАЛЬНАЯ ВЕРСИЯ + LLM HOOK + STUDENTS
// ==========================================================

console.log("JS загружен: main.js");

// --- ГАРАНТИЯ, ЧТО SBI СУЩЕСТВУЕТ И ЕСТЬ БАЗОВЫЕ ХЕЛПЕРЫ ---

window.SBI = window.SBI || {};
const SBI = window.SBI;

// Логгер
if (typeof SBI.log !== "function") {
    SBI.log = function () {
        const args = Array.prototype.slice.call(arguments);
        if (console && console.log) {
            console.log.apply(console, ["[SBI]"].concat(args));
        }
    };
}

// Статус (если нет собственной реализации)
if (typeof SBI.setStatus !== "function") {
    SBI.setStatus = function (msg) {
        console.log("[STATUS]", msg);
        const el = document.getElementById("statusBar");
        if (el) el.textContent = msg;
    };
}

// Числовой парсер (деликатный, с поддержкой запятой)
if (typeof SBI.toNumber !== "function") {
    SBI.toNumber = function (value) {
        if (value == null || value === "") return null;
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }
        const s = String(value).replace(",", ".").trim();
        if (!s) return null;
        const n = Number(s);
        return Number.isNaN(n) ? null : n;
    };
}

// Уникальные значения массива
if (typeof SBI.unique !== "function") {
    SBI.unique = function (arr) {
        if (!Array.isArray(arr)) return [];
        const set = new Set();
        arr.forEach(v => {
            if (v == null) return;
            const s = String(v).trim();
            if (!s) return;
            set.add(s);
        });
        return Array.from(set);
    };
}

// --- LLM helper (llm_cpu.js) presence info ---
if (window.SBI_LLM && typeof window.SBI_LLM.getModelId === "function") {
    SBI.log("LLM helper обнаружен. Модель:", window.SBI_LLM.getModelId());
} else {
    SBI.log("LLM helper (llm_cpu.js) пока не загружен. " +
        "Для AI-интерпретации подключите llm_cpu.js в index.html перед файлами дашбордов.");
}

// ==========================================================
//               ОСНОВНОЙ КОД ЗАГРУЗКИ EXCEL
// ==========================================================

const fileInput = document.getElementById("excelUpload");

SBI.setStatus("Приложение готово. Загрузите Excel-файл.");
SBI.log("Приложение инициализировано. Ожидается загрузка файла.");

/* ------------------------------------------------------
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
------------------------------------------------------ */

function buildPersonName(row, lastKey = "last_name", firstKey = "first_name", middleKey = "middle_name") {
    if (!row) return "";
    const parts = [
        row[lastKey]   != null ? String(row[lastKey]).trim()   : "",
        row[firstKey]  != null ? String(row[firstKey]).trim()  : "",
        row[middleKey] != null ? String(row[middleKey]).trim() : ""
    ].filter(Boolean);
    return parts.join(" ");
}

function buildClassLabel(row) {
    if (!row) return "";
    if (row.class_name) return String(row.class_name).trim();

    const grade   = row.grade ?? row.grade_num ?? row.grade_number;
    const section = row.section ?? row.letter ?? row.class_letter;

    if (grade == null && !section) {
        return String(row.class_id || "").trim();
    }
    return String(row.class_id || `K-${grade}${section || ""}`).trim();
}

function extractGradeFromClassRow(cls) {
    let g = cls.grade ?? cls.grade_num ?? cls.grade_number;
    if (g != null) return g;

    const name = cls.class_name || cls.name || "";
    const m = String(name).match(/\d+/);
    if (m) {
        const num = parseInt(m[0], 10);
        if (!Number.isNaN(num)) return num;
    }
    return null;
}

const toNumber = SBI.toNumber;

/* ------------------------------------------------------
   ОБРАБОТКА ЗАГРУЗКИ EXCEL
------------------------------------------------------ */

if (fileInput) {
    fileInput.addEventListener("change", async () => {

        SBI.log("Событие загрузки файла.");
        const file = fileInput.files[0];
        if (!file) {
            SBI.log("Файл не выбран.");
            SBI.setStatus("Файл не выбран.");
            return;
        }

        SBI.log("Выбран файл: " + file.name);
        SBI.setStatus("Чтение Excel-файла…");

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });

        SBI.log("Найденные листы: " + workbook.SheetNames.join(", "));

        const state  = SBI.state || (SBI.state = {});
        const sheets = workbook.Sheets;

        function readSheet(name) {
            if (!sheets[name]) {
                SBI.log("⚠️ Лист '" + name + "' не найден.");
                return [];
            }
            const rows = XLSX.utils.sheet_to_json(sheets[name], { defval: null });
            SBI.log("Загружено " + rows.length + " строк из листа '" + name + "'.");
            return rows;
        }

        // ------------- Чтение таблиц -------------
        const studentsRaw    = readSheet("УЧАЩИЕСЯ");
        const classesRaw     = readSheet("КЛАССЫ");
        const subjectsRaw    = readSheet("ПРЕДМЕТЫ");
        const termsRaw       = readSheet("ЧЕТВЕРТИ");
        const teachersRaw    = readSheet("УЧИТЕЛЯ");
        const assignmentsRaw = readSheet("НАЗНАЧЕНИЯ_ПРЕПОД");
        const gradesRaw      = readSheet("ОЦЕНКИ");
        const weightsRaw     = readSheet("ВЕСА_ОЦЕНОК");
        const scaleRaw       = readSheet("ШКАЛА_5Б");
        const termResultsRaw = sheets["ИТОГ_ЧЕТВЕРТИ"] ? readSheet("ИТОГ_ЧЕТВЕРТИ") : [];
        const attendanceRaw  = readSheet("ПОСЕЩАЕМОСТЬ");

        // ------------- Индексы -------------
        const idx_students = {};
        studentsRaw.forEach(r => {
            const id = String(r.student_id || "").trim();
            if (id) idx_students[id] = r;
        });

        const idx_classes = {};
        classesRaw.forEach(r => {
            const id = String(r.class_id || "").trim();
            if (id) idx_classes[id] = r;
        });

        const idx_subjects = {};
        subjectsRaw.forEach(r => {
            const id = String(r.subject_id || "").trim();
            if (id) idx_subjects[id] = r;
        });

        const idx_terms = {};
        termsRaw.forEach(r => {
            const id = String(r.term_id || "").trim();
            if (id) idx_terms[id] = r;
        });

        const idx_teachers = {};
        teachersRaw.forEach(r => {
            const id = String(r.teacher_id || "").trim();
            if (id) idx_teachers[id] = r;
        });

        state.idx_students = idx_students;
        state.idx_classes  = idx_classes;
        state.idx_subjects = idx_subjects;
        state.idx_terms    = idx_terms;
        state.idx_teachers = idx_teachers;

        /* ------------------------------------------------------
           ЧТЕНИЕ ВЕСОВ + расчёт итоговых оценок
        ------------------------------------------------------ */
        function getWeights(subject_id, term_id) {
            const sid = subject_id ? String(subject_id).trim() : "";
            const tid = term_id    ? String(term_id).trim()    : "";

            const exact = weightsRaw.find(r =>
                String(r.subject_id || "").trim() === sid &&
                String(r.term_id    || "").trim() === tid
            );

            const subjOnly = !exact && sid &&
                weightsRaw.find(r =>
                    String(r.subject_id || "").trim() === sid &&
                    !r.term_id
                );

            const termOnly = !exact && !subjOnly && tid &&
                weightsRaw.find(r =>
                    !r.subject_id &&
                    String(r.term_id || "").trim() === tid
                );

            const overall = !exact && !subjOnly && !termOnly &&
                weightsRaw.find(r => !r.subject_id && !r.term_id);

            const src = exact || subjOnly || termOnly || overall || {};

            return {
                w_fo:   toNumber(src["ФО"])   || toNumber(src["FO"])   || 25,
                w_sor:  toNumber(src["СОР"])  || toNumber(src["SOR"])  || 25,
                w_soch: toNumber(src["СОЧ"])  || toNumber(src["SOCH"]) || 50
            };
        }

        function mapPercentTo5pt(pct) {
            if (pct == null) return null;
            for (const row of scaleRaw) {
                const min = toNumber(row.pct_min);
                const max = toNumber(row.pct_max);
                if (pct >= min && pct <= max) return toNumber(row.grade_5pt);
            }
            return pct >= 85 ? 5 : pct >= 70 ? 4 : pct >= 55 ? 3 : 2;
        }

        function computeKnowledgeQuality(grade5) {
            return grade5 >= 4 ? 1 : 0;
        }

        const analyticRows = [];

        // Группируем оценки по типу (ФО, СОР, СОЧ) → ключ: student_id|subject_id|term_id|work_type
        const byTypeKey = {};
        gradesRaw.forEach(r => {
            const student_id = String(r.student_id || "").trim();
            const subject_id = String(r.subject_id || "").trim();
            const term_id    = String(r.term_id    || "").trim();
            const work_type  = String(r.work_type  || "").trim();

            if (!student_id || !subject_id || !term_id) return;

            const key = `${student_id}|${subject_id}|${term_id}|${work_type}`;

            if (!byTypeKey[key]) byTypeKey[key] = [];

            let pct = null;
            if (r.percent != null) {
                let frac = toNumber(r.percent);
                if (frac <= 1) frac = frac * 100;
                pct = frac;
            } else if (r.score_percent != null) {
                pct = toNumber(r.score_percent);
            } else if (r.score != null && r.max_score != null) {
                const s = toNumber(r.score);
                const m = toNumber(r.max_score);
                if (s != null && m && m > 0) pct = (s / m) * 100;
            }

            if (pct != null) byTypeKey[key].push(pct);
        });

        // Агрегируем до (student, subject, term)
        const perPST = {};

        Object.keys(byTypeKey).forEach(key => {
            const [student_id, subject_id, term_id, rawType] = key.split("|");

            const pstKey = `${student_id}|${subject_id}|${term_id}`;
            if (!perPST[pstKey]) {
                perPST[pstKey] = {
                    student_id,
                    subject_id,
                    term_id,
                    typeAvgs: {}
                };
            }

            let t = rawType.toString().trim().toUpperCase();
            if (t === "ФО")  t = "FO";
            if (t === "СОР") t = "SOR";
            if (t === "СОЧ") t = "SOCH";

            const arr = byTypeKey[key];
            const avg = SBI.mean(arr);

            perPST[pstKey].typeAvgs[t] = avg;
        });

        // Расчёт итогового процента и 5-балльной оценки
        Object.keys(perPST).forEach(pstKey => {
            const item = perPST[pstKey];
            const { student_id, subject_id, term_id, typeAvgs } = item;

            const weights = getWeights(subject_id, term_id);

            const parts = [];
            if (typeAvgs.FO   != null) parts.push({ avg: typeAvgs.FO,   w: weights.w_fo });
            if (typeAvgs.SOR  != null) parts.push({ avg: typeAvgs.SOR,  w: weights.w_sor });
            if (typeAvgs.SOCH != null) parts.push({ avg: typeAvgs.SOCH, w: weights.w_soch });

            if (!parts.length) return;

            const totalW = parts.reduce((s, p) => s + p.w, 0);
            const final_percent = parts.reduce((s, p) => s + p.avg * p.w, 0) / totalW;

            let class_id = null;
            const anyRow = gradesRaw.find(r =>
                String(r.student_id).trim() === student_id &&
                String(r.subject_id).trim() === subject_id &&
                String(r.term_id).trim()    === term_id
            );
            if (anyRow) class_id = String(anyRow.class_id || anyRow.current_class_id || "").trim();

            const student = idx_students[student_id] || {};
            const cls     = class_id ? (idx_classes[class_id] || {}) : {};
            const subj    = idx_subjects[subject_id] || {};
            const termObj = idx_terms[term_id] || {};

            const student_name = buildPersonName(student);
            const class_name   = buildClassLabel(cls);
            const grade_num    = extractGradeFromClassRow(cls);
            const subject_name = String(subj.subject_name || subj.name || subject_id).trim();

            const final_5scale       = mapPercentTo5pt(final_percent);
            const knowledge_quality  = computeKnowledgeQuality(final_5scale);

            analyticRows.push({
                student_id,
                student_name,
                class_id,
                class: class_name,
                grade: grade_num,
                subject_id,
                subject: subject_name,
                term_id,
                term: term_id,
                final_percent,
                final_5scale,
                knowledge_quality
            });
        });

        /* ------------------------------------------------------
           ПОДГОТОВКА ДАННЫХ ПО УЧИТЕЛЯМ
        ------------------------------------------------------ */

        const allTeachers = teachersRaw.map(t => {
            const id        = String(t.teacher_id || "").trim();
            const readyName = t.teacher_name && String(t.teacher_name).trim();
            const builtName = buildPersonName(t);
            const name      = readyName || builtName || id;
            return {
                ...t,
                teacher_id: id,
                teacher_name: name
            };
        });

        /* ------------------------------------------------------
           ПОСЕЩАЕМОСТЬ
        ------------------------------------------------------ */

        const attendanceProcessed = (attendanceRaw || []).map(r => {
            const student_id = String(r.student_id || "").trim();
            const class_id   = String(r.class_id   || "").trim();
            const term_id    = String(r.term_id    || "").trim();
            const subject_id = String(r.subject_id || "").trim();

            const studentRow   = idx_students[student_id] || {};
            const student_name = buildPersonName(studentRow);

            const total_classes = Number(r.total_classes ?? r.total ?? 0);
            const present_classes = Number(r.present_classes ?? r.present ?? 0);
            const absent_excused_classes   = Number(r.absent_excused_classes   ?? r.absent_excused   ?? 0);
            const absent_unexcused_classes = Number(r.absent_unexcused_classes ?? r.absent_unexcused ?? 0);
            const late_classes = Number(r.late_classes ?? r.late ?? 0);

            return {
                ...r,
                student_id,
                student_name,
                class_id,
                term_id,
                subject_id,
                total_classes,
                present_classes,
                absent_excused_classes,
                absent_unexcused_classes,
                late_classes
            };
        });

        /* ------------------------------------------------------
           СОХРАНЯЕМ ВСЁ В state
        ------------------------------------------------------ */

        state.allRows     = analyticRows;
        state.allTerms    = SBI.unique(analyticRows.map(r => r.term));
        state.allSubjects = SBI.unique(analyticRows.map(r => r.subject));
        state.allClasses  = SBI.unique(analyticRows.map(r => r.class));

        SBI.log("Нормализовано строк (ученик × предмет × четверть): " + analyticRows.length);
        SBI.log("Четверти: " + state.allTerms.join(", "));
        SBI.log("Классы:  " + state.allClasses.join(", "));

        state.students          = studentsRaw;
        state.classesTable      = classesRaw;
        state.subjectsTable     = subjectsRaw;
        state.termsTable        = termsRaw;
        state.teachers          = teachersRaw;
        state.assignments       = assignmentsRaw;

        state.allTeachers        = allTeachers;
        state.teacherAssignments = assignmentsRaw;
        state.idx_subjects       = idx_subjects;

        state.attendanceRows     = attendanceProcessed;

        /* ------------------------------------------------------
           УВЕДОМЛЯЕМ ДАШБОРДЫ
        ------------------------------------------------------ */

        SBI.setStatus("Данные загружены успешно.");

        if (window.SBI_Overview)     SBI_Overview.onDataLoaded?.();
        if (window.SBI_Class)        SBI_Class.onDataLoaded?.();
        if (window.SBI_Subject)      SBI_Subject.onDataLoaded?.();
        if (window.SBI_Teacher)      SBI_Teacher.onDataLoaded?.();
        if (window.SBI_Attendance)   SBI_Attendance.onDataLoaded?.();
        if (window.SBI_Students)     SBI_Students.onDataLoaded?.();   // ← ДОБАВЛЕНО ДЛЯ НОВОЙ ВКЛАДКИ "Ученики"

        // Если в будущем появятся другие дашборды — добавляйте аналогично
    });
}
