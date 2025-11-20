window.SBI_Teacher = (function() {
    
    function update() {
        if (!SBI.state.isLoaded) return;

        const termSel = document.getElementById('tcTerm');
        if (termSel.options.length === 0) {
            SBI.state.terms.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.term_id; opt.text = t.term_id;
                termSel.add(opt);
            });
            termSel.addEventListener('change', renderAll);
            document.getElementById('tcMetric').addEventListener('change', renderTable);
            
            const teachSel = document.getElementById('tcSelectTeacher');
            SBI.state.teachers.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.teacher_id; opt.text = `${t.last_name} ${t.first_name}`;
                teachSel.add(opt);
            });
            teachSel.addEventListener('change', renderStudentDonut);
        }
        renderAll();
    }

    function renderAll() {
        renderQualDonut();
        renderTable();
        renderStudentDonut();
    }

    function renderQualDonut() {
        // Section 1: Teacher Quals. 
        // Selector is Term. Maybe filter teachers active in that term?
        // For now, just all teachers.
        
        const counts = {};
        SBI.state.teachers.forEach(t => {
            // Qual code usually in t.qualification_code or join with TEACHER_QUALS
            // Using raw teacher data assumption from snippet
            let q = t.qualification_code || 'Unknown';
            // Map code to Name if possible
            const qDef = SBI.state.teacherQuals.find(qd => qd.qual_code === q);
            if (qDef) q = qDef.qual_name;
            
            counts[q] = (counts[q] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);

        Plotly.newPlot('tcQualDonut', [{
            values: values, labels: labels, type: 'pie', hole: 0.4
        }]);
    }

    function renderTable() {
        const metric = document.getElementById('tcMetric').value;
        const container = document.getElementById('tcTable');
        const terms = [...new Set(SBI.state.processedGrades.map(r => r.term_id))].sort();

        let html = `<table><thead><tr><th>ФИО</th><th>Категория</th>`;
        terms.forEach(t => html += `<th>${t}</th>`);
        html += `</tr></thead><tbody>`;

        // Min/Max for gradient
        // Need to calculate metrics for all teachers/terms first strictly for range
        // Skipping strict range calc for brevity, using 0-100 or 2-5
        
        SBI.state.teachers.forEach(t => {
            // Get category name
            const qDef = SBI.state.teacherQuals.find(qd => qd.qual_code === t.qualification_code);
            const cat = qDef ? qDef.qual_name : t.qualification_code;

            html += `<tr><td style="text-align:left">${t.last_name} ${t.first_name}</td><td>${cat}</td>`;

            terms.forEach(term => {
                // Find grades given by this teacher in this term
                const rows = SBI.state.processedGrades.filter(r => r.teacher_id === t.teacher_id && r.term_id === term);
                const val = calculateMetric(rows, metric);
                
                let bg = 'transparent';
                if (val !== null) {
                    bg = metric === 'quality' 
                        ? SBI.getGradientColor(val, 0, 100) 
                        : SBI.getGradientColor(val, 2, 5);
                }
                const txt = val !== null ? (metric === 'quality' ? val.toFixed(1)+'%' : val.toFixed(2)) : '-';
                html += `<td style="background:${bg}; color:#fff;">${txt}</td>`;
            });
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    function renderStudentDonut() {
        const tid = document.getElementById('tcSelectTeacher').value;
        const term = document.getElementById('tcTerm').value;

        if (!tid) return;

        // "Shares of Отличник/Хорошист... students of the teacher"
        // As discussed, we interpret this as the distribution of GRADES (5,4,3,2) given by the teacher
        // mapped to labels to show performance in their subject.
        
        const rows = SBI.state.processedGrades.filter(r => r.teacher_id === tid && r.term_id === term);
        
        const counts = { 5:0, 4:0, 3:0, 2:0 };
        rows.forEach(r => {
            if (counts[r.grade] !== undefined) counts[r.grade]++;
        });

        const values = [counts[5], counts[4], counts[3], counts[2]];
        const labels = ['Отлично (5)', 'Хорошо (4)', 'Удовл. (3)', 'Неуд. (2)'];
        const colors = [SBI.colors.grade5, SBI.colors.grade4, SBI.colors.grade3, SBI.colors.grade2];

        Plotly.newPlot('tcStudentDonut', [{
            values: values, labels: labels, type: 'pie', marker: {colors: colors}
        }], { margin: {t:0,b:0,l:0,r:0} });
    }

    function calculateMetric(rows, type) {
        if (!rows.length) return null;
        if (type === 'average') {
            return rows.reduce((a,b)=>a+b.grade,0) / rows.length;
        } else {
            const good = rows.filter(r => r.grade >= 4).length;
            return (good / rows.length) * 100;
        }
    }

    return { update };
})();
