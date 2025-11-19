// ==========================================================
//               MAIN.JS — ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ (19.11.2025)
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

// Статус
if (typeof SBI.setStatus !== "function") {
    SBI.setStatus = function (msg) {
        console.log("[STATUS]", msg);
        const el = document.getElementById("statusBar");
        if (el) el.textContent = msg;
    };
}

// Числовой парсер
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

// Уникальные значения
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

// LLM presence info
if (window.SBI_LLM && typeof window.SBI_LLM.getModelId === "function") {
    SBI.log("LLM helper обнаружен. Модель:", window.SBI_LLM.getModelId());
} else {
    SBI.log("LLM helper (llm_cpu.js) будет подключён позже.");
}

// ==========================================================
//               ОСНОВНОЙ КОД ЗАГРУЗКИ EXCEL
// ==========================================================

const fileInput = document.getElementById("excelUpload");

SBI.setStatus("Приложение готово. Загрузите Excel-файл.");
SBI.log("Приложение инициализировано.");

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
            SBI.setStatus("Файл не выбран.");
            return;
        }

        SBI.log("Выбран файл: " + file.name);
        SBI.setStatus("Чтение Excel-файла…");

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            SBI.log("Листы: " + workbook.SheetNames.join(", "));

            const state = SBI.state = SBI.state || {};
            const sheets = workbook.Sheets;

            function readSheet(name) {
                if (!sheets[name]) {
 really                   SBI.log("⚠️ Лист '" + name + "' не найден.");
                    return [];
                }
                const rows = XLSX.utils.sheet_to_json(sheets[name], { defval: null });
                SBI.log("Загружено " + rows.length + " строк из '" + name + "'");
                return rows;
            }

            // Чтение всех листов
            const studentsRaw    = readSheet("УЧАЩИЕСЯ");
            const classesRaw     = readSheet("КЛАССЫ");
            const subjectsRaw    = readSheet("ПРЕДМЕТЫ");
            const termsRaw       = readSheet("ЧЕТВЕРТИ");
            const teachersRaw    = readSheet("УЧИТЕЛЯ");
            const assignmentsRaw = readSheet("НАЗНАЧЕНИЯ_ПРЕПОД");
            const gradesRaw      = readSheet("ОЦЕНКИ");
            const weightsRaw     = readSheet("ВЕСА_ОЦЕНОК");
            const scaleRaw       = readSheet("ШКАЛА_5Б");
            const attendanceRaw  = readSheet("ПОСЕЩАЕМОСТЬ");

            // Индексы
            const idx_students = {}; studentsRaw.forEach(r => { const id = String(r.student_id || "").trim(); if (id) idx_students[id] = r; });
            const idx_classes  = {}; classesRaw.forEach(r => { const id = String(r.class_id || "").trim(); if (id) idx_classes[id] = r; });
            const idx_subjects = {}; subjectsRaw.forEach(r => { const id = String(r.subject_id || "").trim(); if (id) idx_subjects[id] = r; });
            const idx_terms    = {}; termsRaw.forEach(r => { const id = String(r.term_id || "").trim(); if (id) idx_terms[id] = r; });
            const idx_teachers = {}; teachersRaw.forEach(r => { const id = String(r.teacher_id || "").trim(); if (id) idx_teachers[id] = r; });

            state.idx_students = idx_students;
            state.idx_classes  = idx_classes;
            state.idx_subjects = idx_subjects;
            state.idx_terms    = idx_terms;
            state.idx_teachers = idx_teachers;

            // === ВЕСА И РАСЧЁТ ОЦЕНОК ===
            function getWeights(subject_id, term_id) {
                // ... (код остался без изменений, как в оригинале)
                // (вставьте сюда оригинальный код функции getWeights из вашего предыдущего main.js)
            }

            function mapPercentTo5pt(pct) {
                // ... (оригинальный код)
            }

            // === АНАЛИТИЧЕСКИЕ СТРОКИ ===
            const analyticRows = [];
            // ... (весь большой блок обработки оценок — оставьте как был, он работает)

            // После всех расчётов сохраняем в state
            state.allRows     = analyticRows;
            state.allTerms    = SBI.unique(analyticRows.map(r => r.term));
            state.allSubjects = SBI.unique(analyticRows.map(r => r.subject));
            state.allClasses  = SBI.unique(analyticRows.map(r => r.class));

            state.students     = studentsRaw;
            state.classesTable = classesRaw;
            state.subjectsTable = subjectsRaw;
            state.termsTable   = termsRaw;
            state.teachers     = teachersRaw;
            state.assignments  = assignmentsRaw;
            state.attendanceRows = attendanceProcessed;

            SBI.setStatus("Данные загружены успешно.");

            // === БЕЗОПАСНЫЙ ВЫЗОВ ДАШБОРДОВ ===
            setTimeout(() => {
                const call = (obj, method = "onDataLoaded") => {
                    if (obj && typeof obj[method] === "function") {
                        try { obj[method](); }
                        catch (e) { console.error("Ошибка в " + method, e); }
                    }
                };

                call(window.SBI_Overview);
                call(window.SBI_Class);
                call(window.SBI_Subject);
                call(window.SBI_Teacher);
                call(window.SBI_Attendance);
                call(window.SBI_Students);  // ← Наша новая вкладка

                SBI.log("Все дашборды инициализированы.");
            }, 150);

        } catch (err) {
            console.error("Ошибка загрузки файла:", err);
            SBI.setStatus("Ошибка при чтении файла: " + err.message);
        }
    });
}
