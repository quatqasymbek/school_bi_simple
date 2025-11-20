window.SBI_Subject = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;
        const termSel = document.getElementById('sbTerm');
        if (termSel.options.length === 0) {
            SBI.state.terms.forEach(t => termSel.innerHTML += `<option value="${t.term_id}">${t.term_id}</option>`);
            termSel.addEventListener('change', render);
            document.getElementById('sbMetric').addEventListener('change', render);
        }
        render();
    }

    function render() {
        const term = document.getElementById('sbTerm').value;
        const metric = document.getElementById('sbMetric').value;
        
        // Chart
        const data = [];
        SBI.state.subjects.forEach(s => {
            const rows = SBI.state.processedGrades.filter(r => r.subject_id === s.subject_id && r.term_id === term);
            if(rows.length) {
                let val = 0;
                if(metric==='avg') val = SBI.mean(rows.map(r=>r.grade));
                else val = (rows.filter(r=>r.grade>=4).length/rows.length)*100;
                data.push({ name: s.subject_name, val });
            }
        });
        data.sort((a,b)=>b.val - a.val);
        Plotly.newPlot('sbChart', [{ x: data.map(d=>d.name), y: data.map(d=>d.val), type: 'bar', marker: {color:'#3498db'} }], {margin:{b:100}});

        // Heatmap
        const classes = SBI.state.classes.slice().sort((a,b)=>a.class_name.localeCompare(b.class_name));
        const z = [];
        SBI.state.subjects.forEach(s => {
            const row = [];
            classes.forEach(c => {
                const rows = SBI.state.processedGrades.filter(r => r.subject_id === s.subject_id && r.term_id === term && r.class_id === c.class_id);
                let val = null;
                if(rows.length) {
                    if(metric==='avg') val = SBI.mean(rows.map(r=>r.grade));
                    else val = (rows.filter(r=>r.grade>=4).length/rows.length)*100;
                }
                row.push(val);
            });
            z.push(row);
        });
        
        Plotly.newPlot('sbHeatmap', [{
            z: z, x: classes.map(c=>c.class_name), y: SBI.state.subjects.map(s=>s.subject_name),
            type: 'heatmap', colorscale: 'RdYlGn'
        }], {margin:{l:150}});
    }
    return { update };
})();
