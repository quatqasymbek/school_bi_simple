// overview_ai.js - Local AI Integration for Overview
console.log("OVERVIEW_AI.JS: Loaded");

window.SBI_Overview_AI = (function() {
    let contextData = null;
    let currentTerm = "";

    function init() {
        const btn = document.getElementById("btn-overview-ai");
        if (btn) btn.addEventListener("click", runAnalysis);
    }

    function setContext(rows, term) {
        currentTerm = term;
        
        // Calculate simple stats for the prompt
        const scores = rows.map(r => r.final_5scale);
        const total = scores.length;
        if (total === 0) return;

        const avg = scores.reduce((a,b) => a+b, 0) / total;
        const high = scores.filter(s => s >= 4).length;
        const low = scores.filter(s => s <= 2).length;
        const quality = (high / total) * 100;

        contextData = {
            term: term,
            count: total,
            avg: avg.toFixed(2),
            quality: quality.toFixed(1),
            lowCount: low
        };
    }

    async function runAnalysis() {
        const output = document.getElementById("overview-ai-output");
        const btn = document.getElementById("btn-overview-ai");
        
        if (!window.SBI_LLM) {
            output.textContent = "Ошибка: Модуль AI не загружен.";
            return;
        }
        
        if (!contextData) {
            output.textContent = "Нет данных для анализа. Загрузите Excel файл.";
            return;
        }

        // UI Loading State
        output.textContent = "🤔 ИИ анализирует данные школы... (это может занять время на CPU)";
        btn.disabled = true;

        const prompt = `
        Ты - аналитик данных для директора школы.
        Проанализируй следующие показатели за ${contextData.term}:
        - Средний балл по школе: ${contextData.avg} (из 5)
        - Качество знаний: ${contextData.quality}% (доля оценок 4 и 5)
        - Количество двоечников/троек (низкие оценки): ${contextData.lowCount} записей.

        Дай краткое резюме (3-4 предложения):
        1. Оцени общий уровень (высокий/средний/низкий).
        2. На что обратить внимание (проблемные зоны).
        3. Позитивный тренд, если есть.
        Пиши профессионально, на русском языке.
        `;

        try {
            // Use the SBI_LLM interpret function or direct engine access
            // Assuming standard interface from provided llm_cpu.js (interpret)
            const engine = await SBI_LLM.ensureEngine((msg) => {
                output.textContent = "Загрузка модели: " + msg;
            });
            
            const response = await SBI_LLM.interpret("Анализ успеваемости", prompt);
            output.innerHTML = `<strong>Анализ ИИ:</strong><br/>${response}`;
            
        } catch (e) {
            console.error(e);
            output.textContent = "Ошибка при генерации ответа: " + e.message;
        } finally {
            btn.disabled = false;
        }
    }

    document.addEventListener("DOMContentLoaded", init);

    return { setContext };
})();
