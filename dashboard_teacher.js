window.SBI_Teacher = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;
        
        const selTerm = document.getElementById('tcTerm');
        const selTeach = document.getElementById('tcTeacherSel');
        
        if (selTerm.options.length === 0) {
            SBI.state.terms.forEach(t => selTerm.innerHTML += `<option value="${t.term_id}">${t.term_id}</option>`);
            SBI.state.teachers.forEach(t => selTeach.innerHTML += `<option value="${t.teacher_id}">${t.last_name} ${t.first_name}</option>`);
            
            selTerm.addEventListener('change', renderAll);
            document.getElementById('tcMetric').addEventListener('change', renderTable);
            selTeach.addEventListener('change', renderInd);
        }
        renderAll();
    }

    function renderAll() {
        renderTable();
        renderQual();
        renderInd();
    }

    function renderQual() {
        // Qualification Donut
        const counts = {};
        SBI.state.teachers.forEach(t => {
            const q = t.qualification_code || 'N/A';
            counts[q] = (counts[q]||0)+1;
        });
        Plotly.newPlot('tcQualDonut', [{
            values: Object.values(counts), labels: Object.keys(counts), type: 'pie', hole:0.4
        }], {margin:{t:0,b:0}});
    }

    function renderInd() {
        const tid = document.getElementById('tcTeacherSel').value;
        const term = document.getElementById('tcTerm').value;
        // Grades given by this teacher
        // We need to map student grades to teacher using Assignments
        const assigns = SBI.state.assignments.filter(a => a.teacher_id === tid && a.term_id === term);
        // Filter grades that match these assignments (class + subject)
        const relevantGrades = SBI.state.processedGrades.filter(r => {
            return assigns.some(a => a.class_id === r.class_id && a.subject_id === r.subject_id && r.term_id === term);
        });

        const counts = {5:0, 4:0, 3:0, 2:0};
        relevantGrades.forEach(r => counts[r.grade]++);
        
        Plotly.newPlot('tcIndDonut', [{
            values: [counts[5], counts[4], counts[3], counts[2]],
            labels: ['5','4','3','2'],
            type: 'pie', marker: { colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] }
        }], {margin:{t:0,b:0}});
    }

    function renderTable() {
        const term = document.getElementById('tcTerm').value;
        const metric = document.getElementById('tcMetric').value;
        const div = document.getElementById('tcTable');
        
        // List all teachers, metrics for selected term
        let html = `<table><thead><tr><th>ФИО</th><th>Квалификация</th><th>Показатель</th></tr></thead><tbody>`;
        SBI.state.teachers.forEach(t => {
            // Get grades for this teacher in term
            const assigns = SBI.state.assignments.filter(a => a.teacher_id === t.teacher_id && a.term_id === term);
            const grades = SBI.state.processedGrades.filter(r => {
                return assigns.some(a => a.class_id === r.class_id && a.subject_id === r.subject_id && r.term_id === term);
            });

            let val = '-';
            if (grades.length) {
                if (metric === 'avg') val = (grades.reduce((a,b)=>a+b.grade,0)/grades.length).toFixed(2);
                else val = Math.round((grades.filter(r=>r.grade>=4).length/grades.length)*100) + '%';
            }
            html += `<tr><td>${t.last_name} ${t.first_name}</td><td>${t.qualification_code}</td><td><b>${val}</b></td></tr>`;
        });
        html += `</tbody></table>`;
        div.innerHTML = html;
    }
    return { update };
})();
