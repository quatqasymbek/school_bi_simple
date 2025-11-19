// dashboard_student.js - Student Level Grade Table
console.log("DASHBOARD_STUDENT.JS: Loaded");

window.SBI_Student = (function () {
    const SBI = window.SBI;

    // DOM elements
    let classSelect;
    let termSelect;
    let tableHeader;
    let tableBody;

    function init() {
        classSelect = document.getElementById("stuClassSelect");
        termSelect = document.getElementById("stuTermSelect");
        tableHeader = document.getElementById("stuTableHeader");
        tableBody = document.getElementById("stuTableBody");

        if (classSelect) classSelect.onchange = renderTable;
        if (termSelect) termSelect.onchange = renderTable;
    }

    // Helper: student name
    function getStudentName(sid) {
        const s = (SBI.state.students || []).find(st => st.student_id === sid);
        if (!s) return sid;
        return `${s.last_name || ""} ${s.first_name || ""}`.trim() || sid;
    }

    // Helper: subject name
    function getSubjectName(subId) {
        const subjects = SBI.state.subjects || [];
        const s = subjects.find(sb => sb.subject_id === subId);
        return (s && (s.subject_name || s.name || s.subject || s.title)) || subId;
    }

    // Populate selectors when data is loaded
    function populateSelectors() {
        if (!classSelect || !termSelect) return;

        const rows = SBI.state.allRows || [];
        const classes = SBI.state.classes || [];
        const terms = (SBI.state.allTerms || []).slice().sort();

        // ---- Terms ----
        termSelect.innerHTML = "";
        terms.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            termSelect.appendChild(opt);
        });

        // ---- Classes ----
        // Only classes that appear in allRows
        const classIds = SBI.unique(rows.map(r => r.class_id)).sort((a, b) =>
            String(a || "").localeCompare(String(b || ""), undefined, { numeric: true })
        );

        const classMap = {};
        classes.forEach(c => { if (c.class_id) classMap[c.class_id] = c; });

        classSelect.innerHTML = "";
        classIds.forEach(cid => {
            const cls = classMap[cid] || { class_id: cid };
            const opt = document.createElement("option");
            opt.value = cid;
            opt.textContent = cls.class_name || cid; // e.g. "6Ә"
            classSelect.appendChild(opt);
        });

        // Defaults
        if (terms.length > 0 && !termSelect.value) termSelect.value = terms[0];
        if (classIds.length > 0 && !classSelect.value) classSelect.value = classIds[0];
    }

    function renderTable() {
        if (!classSelect || !termSelect || !tableHeader || !tableBody) return;

        const clsId = classSelect.value;
        const term = termSelect.value;

        tableHeader.innerHTML = "";
        tableBody.innerHTML = "";

        if (!clsId || !term) {
            return;
        }

        const allRows = SBI.state.allRows || [];
        const rows = allRows.filter(r => r.class_id === clsId && String(r.term) === String(term));

        if (!rows.length) {
            // Basic header
            tableHeader.innerHTML = `
                <th>Ученик</th>
                <th>ID ученика</th>
                <th>Средний балл</th>
            `;
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 3;
            td.style.padding = "20px";
            td.style.color = "#999";
            td.textContent = "Нет оценок для выбранного класса и четверти.";
            tr.appendChild(td);
            tableBody.appendChild(tr);
            return;
        }

        // Subjects for this class+term
        const subjectIds = SBI.unique(rows.map(r => r.subject_id)).sort((a, b) => {
            const an = getSubjectName(a);
            const bn = getSubjectName(b);
            return an.localeCompare(bn, "ru", { sensitivity: "base" });
        });

        // ---- Build header ----
        let th;

        th = document.createElement("th");
        th.textContent = "Ученик";
        tableHeader.appendChild(th);

        th = document.createElement("th");
        th.textContent = "ID ученика";
        tableHeader.appendChild(th);

        subjectIds.forEach(subId => {
            const thSub = document.createElement("th");
            thSub.textContent = getSubjectName(subId);
            tableHeader.appendChild(thSub);
        });

        th = document.createElement("th");
        th.textContent = "Средний балл";
        tableHeader.appendChild(th);

        // ---- Determine students list for this class ----
        const studentsAll = SBI.state.students || [];
        const studentsInClass = studentsAll.filter(s => s.class_id === clsId && s.student_id);
        const idsFromClass = studentsInClass.map(s => s.student_id);
        const idsFromRows = SBI.unique(rows.map(r => r.student_id));

        let studentIds = idsFromClass.length ? idsFromClass.slice() : idsFromRows.slice();
        // Ensure all with grades are included
        idsFromRows.forEach(id => {
            if (!studentIds.includes(id)) studentIds.push(id);
        });

        // Sort by name
        studentIds.sort((a, b) =>
            getStudentName(a).localeCompare(getStudentName(b), "ru", { sensitivity: "base" })
        );

        // ---- Build rows ----
        studentIds.forEach(sid => {
            const tr = document.createElement("tr");

            // Col 1: student name
            const tdName = document.createElement("td");
            tdName.style.textAlign = "left";
            tdName.innerHTML = `
                <div style="font-weight:500;">${getStudentName(sid)}</div>
            `;
            tr.appendChild(tdName);

            // Col 2: student id
            const tdId = document.createElement("td");
            tdId.textContent = sid;
            tr.appendChild(tdId);

            // Subject grades + collect for average
            const gradesForAvg = [];

            subjectIds.forEach(subId => {
                const cellRows = rows.filter(r => r.student_id === sid && r.subject_id === subId);
                const gradeVal = cellRows.length ? cellRows[0].final_5scale : null;

                const td = document.createElement("td");

                if (gradeVal == null || gradeVal === "" || isNaN(gradeVal)) {
                    td.textContent = "—";
                    td.style.color = "#ccc";
                } else {
                    const valNum = Number(gradeVal);
                    td.textContent = valNum.toFixed(0);
                    if (valNum >= 4.5) td.classList.add("grade-good");
                    if (valNum < 3.0) td.classList.add("grade-bad");
                    gradesForAvg.push(valNum);
                }

                tr.appendChild(td);
            });

            // Average column
            const tdAvg = document.createElement("td");
            if (gradesForAvg.length) {
                const avg = SBI.mean(gradesForAvg);
                tdAvg.textContent = avg.toFixed(2);
                if (avg >= 4.5) tdAvg.classList.add("grade-good");
                if (avg < 3.0) tdAvg.classList.add("grade-bad");
            } else {
                tdAvg.textContent = "—";
                tdAvg.style.color = "#ccc";
            }
            tr.appendChild(tdAvg);

            tableBody.appendChild(tr);
        });
    }

    function onDataLoaded() {
        populateSelectors();
        renderTable();
    }

    document.addEventListener("DOMContentLoaded", init);

    return {
        onDataLoaded: onDataLoaded
    };
})();
