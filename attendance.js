// attendance.js - Attendance Dashboard Logic
console.log("ATTENDANCE.JS: Loaded");

window.SBI_Attendance = (function() {
    const SBI = window.SBI;

    // DOM Elements
    let summaryWrapper;
    let detailWrapper;
    let termSummarySelect;
    let termDetailSelect;
    let classDetailSelect;

    function init() {
        summaryWrapper = document.getElementById("attSummaryTableWrapper");
        detailWrapper = document.getElementById("attDetailTableWrapper");

        termSummarySelect = document.getElementById("attTermSummary");
        termDetailSelect  = document.getElementById("attTermDetail");
        classDetailSelect = document.getElementById("attClassDetail");

        if (termSummarySelect) termSummarySelect.onchange = renderSummary;
        if (termDetailSelect)  termDetailSelect.onchange  = renderDetail;
        if (classDetailSelect) classDetailSelect.onchange = renderDetail;
    }

    // Helper: Get Student Name
    function getStudentName(sid) {
        const s = SBI.state.students.find(st => st.student_id === sid);
        if (!s) return sid;
        return `${s.last_name || ""} ${s.first_name || ""}`.trim() || sid;
    }

    // Helper: Get Kazakh Class Name
    function getClassName(cid) {
        const c = SBI.state.classes.find(cl => cl.class_id === cid);
        if (!c) return cid; // Fallback to ID if not found
        return c.class_name || cid; // e.g. "1 «А» сыныбы"
    }

    function onDataLoaded() {
        const rows = SBI.state.attendanceRows || [];
        if (!rows.length) {
            if (summaryWrapper) summaryWrapper.innerHTML = "<p style='padding:15px; color:#888'>Нет данных о посещаемости.</p>";
            return;
        }

        // Populate Selectors
        // Terms
        const terms = SBI.unique(rows.map(r => r.term_id)).sort();
        fillSelect(termSummarySelect, terms);
        fillSelect(termDetailSelect, terms);

        // Classes (IDs for value, Kazakh Names for display)
        const classIds = SBI.unique(rows.map(r => r.class_id)).sort();
        if (classDetailSelect) {
            classDetailSelect.innerHTML = "";
            classIds.forEach(cid => {
                const opt = document.createElement("option");
                opt.value = cid;
                opt.textContent = getClassName(cid); // Show "1 «А» сыныбы"
                classDetailSelect.appendChild(opt);
            });
        }

        // Default selections
        if (terms.length > 0) {
            if(termSummarySelect) termSummarySelect.value = terms[0];
            if(termDetailSelect) termDetailSelect.value = terms[0];
        }
        if (classIds.length > 0 && classDetailSelect) {
            classDetailSelect.value = classIds[0];
        }

        renderSummary();
        renderDetail();
    }

    function fillSelect(select, values) {
        if (!select) return;
        select.innerHTML = "";
        values.forEach(v => {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = v;
            select.appendChild(opt);
        });
    }

    // ==========================================
    // 1. SUMMARY TABLE (School Wide)
    // ==========================================
    function renderSummary() {
        if (!summaryWrapper || !termSummarySelect) return;
        const term = termSummarySelect.value;
        const rows = SBI.state.attendanceRows.filter(r => r.term_id === term);

        // Aggregate by Class
        const classStats = {};

        rows.forEach(r => {
            const cid = r.class_id;
            if (!classStats[cid]) classStats[cid] = { total: 0, present: 0, late: 0, exc: 0, unexc: 0 };
            
            classStats[cid].total += (parseInt(r.total_classes) || 0);
            classStats[cid].present += (parseInt(r.present_classes) || 0);
            classStats[cid].late += (parseInt(r.late_classes) || 0);
            classStats[cid].exc += (parseInt(r.absent_excused_classes) || 0);
            classStats[cid].unexc += (parseInt(r.absent_unexcused_classes) || 0);
        });

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Класс</th>
                        <th>% Посещаемости</th>
                        <th>Всего уроков</th>
                        <th>Присутствовал</th>
                        <th>Опоздания</th>
                        <th>Ув. причины</th>
                        <th>Неув. причины</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Sort by Class ID for consistency
        Object.keys(classStats).sort().forEach(cid => {
            const s = classStats[cid];
            const pct = s.total > 0 ? ((s.present / s.total) * 100).toFixed(1) : "-";
            
            html += `
                <tr>
                    <td style="text-align:left; font-weight:bold;">${getClassName(cid)}</td>
                    <td style="font-weight:bold; color:${parseFloat(pct) < 90 ? '#e74c3c' : '#2ecc71'}">${pct}%</td>
                    <td>${s.total}</td>
                    <td>${s.present}</td>
                    <td>${s.late}</td>
                    <td>${s.exc}</td>
                    <td>${s.unexc}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        summaryWrapper.innerHTML = html;
    }

    // ==========================================
    // 2. DETAIL TABLE (By Student)
    // ==========================================
    function renderDetail() {
        if (!detailWrapper || !termDetailSelect || !classDetailSelect) return;
        
        const term = termDetailSelect.value;
        const classId = classDetailSelect.value;

        // Filter rows for this class and term
        const rows = SBI.state.attendanceRows.filter(r => r.term_id === term && r.class_id === classId);

        if (rows.length === 0) {
            detailWrapper.innerHTML = "<div style='padding:20px; text-align:center; color:#999'>Нет данных для выбранного класса и четверти.</div>";
            return;
        }

        // AGGREGATE BY STUDENT
        // Since rows are per-subject, we must sum them up to get "Total Classes" for the student
        const studentStats = {};

        rows.forEach(r => {
            const sid = r.student_id;
            if (!studentStats[sid]) {
                studentStats[sid] = { 
                    sid: sid,
                    total: 0, present: 0, late: 0, exc: 0, unexc: 0 
                };
            }
            
            studentStats[sid].total += (parseInt(r.total_classes) || 0);
            studentStats[sid].present += (parseInt(r.present_classes) || 0);
            studentStats[sid].late += (parseInt(r.late_classes) || 0);
            studentStats[sid].exc += (parseInt(r.absent_excused_classes) || 0);
            studentStats[sid].unexc += (parseInt(r.absent_unexcused_classes) || 0);
        });

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Ученик</th>
                        <th>Посещаемость</th>
                        <th>Всего уроков</th>
                        <th>Присутствовал</th>
                        <th>Опоздания</th>
                        <th>Ув. пропуски</th>
                        <th>Неув. пропуски</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Sort alphabetically by name
        const sortedStudents = Object.values(studentStats).sort((a, b) => {
            return getStudentName(a.sid).localeCompare(getStudentName(b.sid));
        });

        sortedStudents.forEach(s => {
            const pct = s.total > 0 ? ((s.present / s.total) * 100).toFixed(1) : 0;
            const colorClass = parseFloat(pct) < 85 ? 'color:#e74c3c' : 'color:#333'; // Highlight bad attendance

            html += `
                <tr>
                    <td style="text-align:left;">
                        <div style="font-weight:500;">${getStudentName(s.sid)}</div>
                        <div style="font-size:0.8em; color:#999;">${s.sid}</div>
                    </td>
                    <td style="font-weight:bold; ${colorClass}">${pct}%</td>
                    <td>${s.total}</td>
                    <td>${s.present}</td>
                    <td>${s.late}</td>
                    <td>${s.exc}</td>
                    <td>${s.unexc}</td>
                </tr>
            `;
        });

        html += "</tbody></table>";
        
        // Add footer explanation
        html += `
            <div style="margin-top:10px; font-size:0.85rem; color:#666; font-style:italic;">
                * "Всего уроков" — сумма уроков по всем предметам, за которые выставлена посещаемость.
            </div>
        `;

        detailWrapper.innerHTML = html;
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        onDataLoaded: onDataLoaded
    };
})();
