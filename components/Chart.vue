<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import {
    Chart,
    BarController,
    BarElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Title
} from 'chart.js';
import Papa from 'papaparse';

Chart.register(
    BarController,
    BarElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Title
);

const props = defineProps({
    csvPath: {
        type: String,
        required: true,
        validator: value => value.startsWith('/data/')
    }
});

const chartRef = ref(null);
const chartInstance = ref(null);
const loading = ref(true);
const error = ref(null);

const processData = (csvText) => {
    const tasks = {};
    const { data } = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value, field) => {
            if (field === 'timestamp') return new Date(value).getTime();
            return value;
        }
    });

    data.forEach(row => {
        if (!row.timestamp || !row.task_name || !row.action) return;

        const key = `${row.task_name}_${row.core_id || 0}`;
        if (!tasks[key]) {
            tasks[key] = {
                intervals: [],
                color: getTaskColor(row.task_name),
                core: row.core_id || 0
            };
        }

        if (row.action === 'begin') {
            tasks[key].intervals.push({
                start: row.timestamp,
                file: row.file_source
            });
        } else if (row.action === 'end' && tasks[key].intervals.length > 0) {
            const lastInterval = tasks[key].intervals[tasks[key].intervals.length - 1];
            if (!lastInterval.end) lastInterval.end = row.timestamp;
        }
    });

    return tasks;
};

const getTaskColor = (taskName) => {
    const colors = {
        Mem: '#A3E635',    // Verde lima
        Main: '#10B981',   // Verde esmeralda
        Cache: '#34D399',  // Verde menta
        default: '#6EE7B7' // Verde claro
    };
    return colors[taskName.replace(/[0-9]/g, '')] || colors.default;
};

const createChart = (tasks) => {
    const datasets = Object.entries(tasks).map(([task, data]) => {
        const points = data.intervals.flatMap(interval => {
            const duration = interval.end
                ? interval.end - interval.start
                : 100;

            return [
                {
                    x: interval.start,
                    y: task,
                    custom: {
                        duration,
                        core: data.core,
                        file: interval.file
                    }
                },
                { x: interval.start + duration, y: task }
            ];
        });

        return {
            label: task.replace('_', ' Core '),
            data: points,
            backgroundColor: data.color + 'CC', // 80% de opacidad
            borderColor: data.color,
            borderWidth: 1,
            barThickness: 24,
            borderRadius: 4,
            borderSkipped: false,
        };
    });

    if (chartInstance.value) {
        chartInstance.value.destroy();
    }

    chartInstance.value = new Chart(chartRef.value, {
        type: 'bar',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    min: 0,
                    max: 12000,
                    ticks: {
                        stepSize: 500,
                        color: '#A3E635',
                        callback: (value) => `${(value / 1000).toFixed(1)}s`
                    },
                    grid: {
                        color: '#1E3D38',
                        drawBorder: false
                    }
                },
                y: {
                    type: 'category',
                    grid: {
                        color: '#1E3D38',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#A3E635',
                        font: {
                            weight: 'bold'
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#16302B',
                    titleColor: '#A3E635',
                    bodyColor: '#ECFDF5',
                    borderColor: '#10B981',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => {
                            const data = ctx.raw.custom;
                            return [
                                `Duración: ${data.duration}ms`,
                                `Core: ${data.core}`,
                                `Archivo: ${data.file || 'N/A'}`
                            ];
                        }
                    }
                }
            }
        }
    });
};

onMounted(async () => {
    try {
        loading.value = true;
        const response = await fetch(props.csvPath);
        if (!response.ok) throw new Error('Error al cargar archivo');

        const csvText = await response.text();
        const tasks = processData(csvText);

        if (Object.keys(tasks).length === 0) {
            throw new Error('No hay datos válidos en el CSV');
        }

        createChart(tasks);
    } catch (err) {
        error.value = err.message;
        console.error('Error:', err);
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => {
    if (chartInstance.value) {
        chartInstance.value.destroy();
    }
});
</script>

<template>
    <div class="relative h-full w-full bg-primary-dark">
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-primary-dark/90 z-10">
            <div class="animate-pulse text-accent-text">
                Cargando datos...
            </div>
        </div>

        <div v-if="error" class="p-4 bg-red-900/30 border border-red-600 rounded-lg text-red-200">
            {{ error }}
        </div>

        <div class="p-4 h-[70vh] min-h-[500px]">
            <canvas ref="chartRef" class="w-full h-full" :class="{ 'opacity-50': loading }" />
        </div>
    </div>
</template>