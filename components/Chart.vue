<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import ChartLegend from './ChartLegend.vue';
import ChartConfig from './ChartConfig.vue';
import ChartStats from './ChartStats.vue';

const chartRef = ref(null);
const chartInstance = ref(null);
const loading = ref(true);
const error = ref(null);
const isMounted = ref(false);
const rawData = ref([]);
const allTasks = ref([]);
const isRendering = ref(false);

const chartData = computed(() => chartInstance.value?.data?.datasets?.[0]?.data || []);

const config = ref({
  showAll: true,
  selectedTypes: [],
  timeMode: 'all',
  startTime: 0,
  endTime: 0
});

const availableTypes = computed(() => {
  const types = new Set();
  allTasks.value.forEach(task => {
    types.add(task.type);
  });
  return Array.from(types).sort();
});

const timeRange = computed(() => {
  if (!allTasks.value.length) return { min: 0, max: 0 };

  const allTimes = allTasks.value.flatMap(t => t.segments.flatMap(s => [s.start, s.end]));
  const minTime = Math.min(...allTimes) / 60_000_000_000;
  const maxTime = Math.max(...allTimes) / 60_000_000_000;

  return { min: minTime, max: maxTime };
});

const effectiveTimeRange = computed(() => {
  const range = timeRange.value;
  if (config.value.timeMode === 'custom') {
    return {
      min: config.value.startTime,
      max: config.value.endTime
    };
  }
  return range;
});

const filteredTasks = computed(() => {
  if (!allTasks.value.length) return [];

  let filtered = allTasks.value;

  if (!config.value.showAll && config.value.selectedTypes.length > 0) {
    filtered = filtered.filter(task => config.value.selectedTypes.includes(task.type));
  }

  if (config.value.timeMode === 'custom') {
    const startNanos = config.value.startTime * 60_000_000_000;
    const endNanos = config.value.endTime * 60_000_000_000;

    filtered = filtered.filter(task => {
      const taskStart = task.segments[0].start;
      const taskEnd = task.segments[0].end;
      return taskStart < endNanos && taskEnd > startNanos;
    });
  }

  return filtered;
});

const props = defineProps({
  jsonPath: {
    type: String,
    required: true,
    validator: value => value.startsWith('/data/')
  }
});

onMounted(async () => {
  isMounted.value = true;
  await loadData();
});

const handleConfigChange = (newConfig) => {
  config.value = { ...newConfig };
  if (allTasks.value.length > 0) {
    renderChart();
  }
};

const loadData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const ChartJS = await import('chart.js');
    const { Chart, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Title } = ChartJS;
    const annotationPlugin = await import('chartjs-plugin-annotation');
    const zoomPlugin = await import('chartjs-plugin-zoom');
    Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Title);
    Chart.register(annotationPlugin.default);
    Chart.register(zoomPlugin.default);

    const response = await fetch(props.jsonPath);
    if (!response.ok) throw new Error('Error loading file');
    const data = await response.json();

    rawData.value = data;
    allTasks.value = processData(data);

    if (!allTasks.value.length) throw new Error('No valid data in JSON');

    const range = timeRange.value;
    config.value = {
      showAll: true,
      selectedTypes: availableTypes.value,
      timeMode: 'all',
      startTime: range.min,
      endTime: range.max
    };

    renderChart();
  } catch (err) {
    error.value = err.message;
    console.error('Error:', err);
  } finally {
    loading.value = false;
  }
};

watch(() => props.jsonPath, async () => {
  if (isMounted.value) await loadData();
});

watch(() => filteredTasks.value, () => {
  if (isMounted.value && filteredTasks.value.length > 0) {
    renderChart();
  }
}, { deep: true });

const processData = (rawData) => {
  const nameCounts = {};
  let cumulativeStart = 0;

  const getTaskType = (name) => {
    if (!name) return 'UNKNOWN';
    const parts = name.split('_');
    return parts[0] || 'UNKNOWN';
  };

  return rawData.map((item, index) => {
    const duration = item.duration || 0;
    const taskName = item.name || `UNKNOWN_${index + 1}`;
    const taskType = getTaskType(taskName);
    const start = item.start !== undefined ? item.start : cumulativeStart;
    const end = item.end !== undefined ? item.end : start + duration;

    if (item.start === undefined) {
      cumulativeStart = end;
    }

    const count = nameCounts[taskName] = (nameCounts[taskName] || 0) + 1;
    const displayName = `${taskName}[${count}] - ${formatTime(duration)}`;
    const colorScheme = getColorForTask(taskName);

    return {
      name: displayName,
      originalName: taskName,
      type: taskType,
      originalData: item,
      colorScheme: colorScheme,
      segments: [{
        start: start,
        end: end,
        duration: duration
      }]
    };
  });
};

const getColorForTask = (taskName) => {
  const type = taskName.split('_')[0];
  const colorMap = {
    'Main': {
      primary: '#DC2626',
      secondary: '#B91C1C',
      border: '#EF4444'
    },
    'ROM': {
      primary: '#1E40AF',
      secondary: '#1E3A8A',
      border: '#3B82F6'
    },
    'INPUT': {
      primary: '#6B21A8',
      secondary: '#581C87',
      border: '#8B5CF6'
    },
    'MEM': {
      primary: '#166534',
      secondary: '#14532D',
      border: '#22C55E'
    },
    'BINARY': {
      primary: '#C2410C',
      secondary: '#9A3412',
      border: '#F97316'
    },
    'ARITH': {
      primary: '#0EA5E9',
      secondary: '#0369A1',
      border: '#38BDF8'
    },
    'KECCAKF': {
      primary: '#DB2777',
      secondary: '#BE185D',
      border: '#EC4899'
    },
    'MT': {
      primary: '#059669',
      secondary: '#047857',
      border: '#10B981'
    },
    'DEFAULT': {
      primary: '#6B7280',
      secondary: '#4B5563',
      border: '#9CA3AF'
    }
  };
  return colorMap[type] || colorMap.DEFAULT;
};

const formatTime = (time) => {
  if (time >= 1_000_000_000) {
    return `${(time / 1_000_000_000).toFixed(3)}s`;
  } else if (time >= 1_000_000) {
    return `${(time / 1_000_000).toFixed(3)}ms`;
  } else if (time >= 1_000) {
    return `${(time / 1_000).toFixed(3)}μs`;
  } else {
    return `${time.toFixed(0)}ns`;
  }
};

const renderChart = async () => {
  if (!filteredTasks.value.length || isRendering.value) return;

  isRendering.value = true;

  try {
    if (chartInstance.value) {
      chartInstance.value.destroy();
      chartInstance.value = null;
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    const tasks = filteredTasks.value;
    const range = effectiveTimeRange.value;

    const minTimeMin = range.min;
    const maxTimeMin = range.max;
    const timeRangeMin = maxTimeMin - minTimeMin;

    const adjustedRange = {
      min: range.min,
      max: timeRangeMin < 0.000001 ? range.min + 0.000001 : range.max
    };

    const formatTimeForDisplay = (nanoseconds) => {
      if (nanoseconds >= 1_000_000_000) {
        return `${(nanoseconds / 1_000_000_000).toFixed(3)} s`;
      } else if (nanoseconds >= 1_000_000) {
        return `${(nanoseconds / 1_000_000).toFixed(3)} ms`;
      } else if (nanoseconds >= 1_000) {
        return `${(nanoseconds / 1_000).toFixed(3)} μs`;
      } else {
        return `${nanoseconds.toFixed(0)} ns`;
      }
    };

    const data = tasks.map(task => {
      const colorScheme = task.colorScheme;
      const startMin = task.segments[0].start / 60_000_000_000;
      const endMin = task.segments[0].end / 60_000_000_000;
      const durationNanos = task.segments[0].duration;
      return {
        x: [startMin, endMin],
        y: task.name,
        backgroundColor: colorScheme.primary + 'E6',
        borderColor: colorScheme.border,
        hoverBackgroundColor: colorScheme.primary + 'F2',
        hoverBorderColor: colorScheme.secondary,
        custom: {
          ...task.originalData,
          duration: durationNanos,
          task: task.type,
          subtask: task.originalName.split('_')[1] || '',
          absoluteStartTime: startMin,
          absoluteEndTime: endMin,
          formattedDuration: formatTimeForDisplay(durationNanos),
          formattedAbsoluteStart: startMin.toFixed(8) + ' min',
          formattedAbsoluteEnd: endMin.toFixed(8) + ' min'
        }
      };
    });

    const globalTypeStats = {};
    const totalDurationNanos = allTasks.value.reduce((sum, task) => sum + task.segments[0].duration, 0);

    allTasks.value.forEach(task => {
      const type = task.type;
      if (!globalTypeStats[type]) {
        globalTypeStats[type] = {
          totalDuration: 0,
          count: 0
        };
      }
      globalTypeStats[type].totalDuration += task.segments[0].duration;
      globalTypeStats[type].count++;
    });

    const uniqueTypes = [];
    const typesSeen = new Set();

    tasks.forEach(task => {
      const type = task.type;
      if (!typesSeen.has(type)) {
        typesSeen.add(type);
        uniqueTypes.push(type);
      }
    });

    const totalTasks = tasks.length;
    const yLabels = new Array(totalTasks).fill('');

    uniqueTypes.forEach((type, index) => {
      const position = Math.floor((index + 0.5) * totalTasks / uniqueTypes.length);
      const globalStats = globalTypeStats[type];
      const durationNanos = globalStats.totalDuration;
      const percentage = ((globalStats.totalDuration / totalDurationNanos) * 100).toFixed(1);
      const formattedDuration = formatTimeForDisplay(durationNanos);

      yLabels[position] = `${type} - Total: ${formattedDuration} (${percentage}%)`;
    });

    const ChartJS = await import('chart.js');
    const { Chart } = ChartJS;

    if (!chartRef.value) {
      console.error('Canvas element not available');
      return;
    }

    chartInstance.value = new Chart(chartRef.value, {
      type: 'bar',
      data: {
        labels: tasks.map(task => task.name),
        datasets: [{
          label: 'Tareas',
          data,
          backgroundColor: data.map(d => d.backgroundColor),
          borderColor: data.map(d => d.borderColor),
          borderWidth: 1,
          barPercentage: 0.95,
          categoryPercentage: 0.95,
          borderRadius: 2,
          borderSkipped: false,
          minBarLength: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        parsing: {
          xAxisKey: 'x',
          yAxisKey: 'y'
        },
        layout: {
          padding: {
            top: 20,
            bottom: 20,
            right: 30
          }
        },
        scales: {
          x: {
            type: 'linear',
            min: config.value.timeMode === 'custom' ? adjustedRange.min : 0,
            max: adjustedRange.max,
            display: true,
            title: {
              display: true,
              text: 'Absolute time (minutes)',
              color: '#A3E635',
              font: {
                size: 13,
                weight: '600',
                family: 'Inter, system-ui, sans-serif'
              }
            },
            ticks: {
              display: true,
              color: '#A3E635',
              font: {
                size: 11,
                weight: '500',
                family: 'Inter, system-ui, sans-serif'
              },
              maxTicksLimit: 10,
              callback: v => {
                if (timeRangeMin < 0.000001) return `${v.toFixed(8)} min`;
                if (timeRangeMin < 0.00001) return `${v.toFixed(7)} min`;
                if (timeRangeMin < 0.0001) return `${v.toFixed(6)} min`;
                if (timeRangeMin < 0.001) return `${v.toFixed(5)} min`;
                if (timeRangeMin < 0.01) return `${v.toFixed(4)} min`;
                if (timeRangeMin < 0.1) return `${v.toFixed(3)} min`;
                return `${v.toFixed(2)} min`;
              }
            },
            grid: {
              display: true,
              color: 'var(--color-chart-grid)',
              drawBorder: true,
              borderColor: 'var(--color-primary-dark)',
              borderWidth: 1,
              lineWidth: 0.5
            }
          },
          y: {
            type: 'category',
            labels: tasks.map(task => task.name),
            offset: true,
            display: true,
            title: {
              display: true,
              color: '#A3E635',
              font: {
                size: 13,
                weight: '600',
                family: 'Inter, system-ui, sans-serif'
              }
            },
            grid: {
              display: true,
              color: 'var(--color-chart-grid)',
              drawBorder: true,
              borderColor: 'var(--color-primary-dark)',
              borderWidth: 1,
              lineWidth: 0.5
            },
            ticks: {
              display: true,
              color: '#A3E635',
              font: {
                weight: '500',
                size: 10,
                family: 'Inter, system-ui, sans-serif'
              },
              autoSkip: false,
              mirror: false,
              padding: 8,
              maxRotation: 0,
              minRotation: 0,
              callback: function (value, index, values) {
                return yLabels[index] || '';
              }
            },
          }
        },
        plugins: {
          tooltip: {
            backgroundColor: 'var(--color-primary-dark)',
            titleColor: '#A3E635',
            bodyColor: '#E2E8F0',
            borderColor: 'var(--color-chart-grid)',
            borderWidth: 1,
            padding: 16,
            bodySpacing: 8,
            cornerRadius: 8,
            displayColors: true,
            usePointStyle: true,
            boxPadding: 6,
            titleFont: {
              size: 14,
              weight: '600',
              family: 'Inter, system-ui, sans-serif'
            },
            bodyFont: {
              size: 12,
              weight: '400',
              family: 'Inter, system-ui, sans-serif'
            },
            callbacks: {
              label: (ctx) => {
                const custom = ctx.raw?.custom || {};
                return [
                  `Inicio: ${custom.formattedAbsoluteStart}`,
                  `Final: ${custom.formattedAbsoluteEnd}`,
                  `Duración: ${custom.formattedDuration}`,
                ];
              }
            }
          },
          legend: {
            display: false
          }, annotation: {
            annotations: {
              maxTimeLine: {
                type: 'line',
                xMin: adjustedRange.max,
                xMax: adjustedRange.max,
                borderColor: '#EF4444',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: `End time: ${adjustedRange.max.toFixed(2)} min`,
                  position: 'end',
                  backgroundColor: 'rgba(239, 68, 68, 0.8)',
                  color: '#FFFFFF',
                  font: {
                    size: 11,
                    weight: '600'
                  },
                  padding: 4,
                  cornerRadius: 4
                }
              }
            }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'xy',
              modifierKey: null,
              onPanComplete: function ({ chart }) {
                console.log('Pan completed');
              }
            },
            zoom: {
              wheel: {
                enabled: true,
                speed: 0.1
              },
              pinch: {
                enabled: true
              },
              mode: 'xy',
              drag: {
                enabled: false
              },
              onZoomComplete: function ({ chart }) {
                console.log('Zoom completed');
              }
            },
            limits: {
              x: { min: adjustedRange.min - (adjustedRange.max - adjustedRange.min), max: adjustedRange.max * 3 },
              y: { min: -tasks.length * 0.5, max: tasks.length * 1.5 }
            }
          }
        }
      }
    });

    const chartContainer = chartRef.value.parentElement;
    const availableHeight = window.innerHeight - 200;
    const barHeight = 40;
    const spacing = 6;
    const totalHeight = Math.max(tasks.length * (barHeight + spacing), 600);

    chartContainer.style.height = `${availableHeight + 150}px`;
    chartRef.value.style.height = `${totalHeight}px`;
    chartRef.value.style.width = '80%';
  } catch (chartError) {
    console.error('Error rendering chart:', chartError);
    error.value = 'Error rendering chart';
  } finally {
    isRendering.value = false;
  }
};

onUnmounted(() => {
  if (chartInstance.value) chartInstance.value.destroy();
});

const resetZoom = () => {
  if (chartInstance.value) {
    chartInstance.value.resetZoom();
  }
};

const zoomIn = () => {
  if (chartInstance.value) {
    chartInstance.value.zoom(1.2);
  }
};

const zoomOut = () => {
  if (chartInstance.value) {
    chartInstance.value.zoom(0.8);
  }
};
</script>

<template>
  <div class="min-h-screen w-full bg-primary-dark flex flex-col">
    <div v-if="error"
      class="absolute top-6 left-1/2 transform -translate-x-1/2 bg-red-50 text-red-800 px-6 py-3 rounded-lg border border-red-200 shadow-sm z-50">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd" />
        </svg>
        {{ error }}
      </div>
    </div>

    <div class="flex-1 w-full px-4 py-6 flex flex-col">
      <div class="w-full max-w-[1800px] mx-auto mb-6">
        <ChartConfig v-if="isMounted && allTasks.length > 0" :available-types="availableTypes" :min-time="timeRange.min"
          :max-time="timeRange.max" :config="config" @config-change="handleConfigChange" />
      </div>

      <div class="flex-1 w-full max-w-[1800px] mx-auto mb-6 relative">
        <div class="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button @click="zoomIn"
            class="bg-primary-dark border border-white text-accent-text hover:bg-[#2A5751] px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center"
            title="Zoom In">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button @click="zoomOut"
            class="bg-primary-dark border border-white text-accent-text hover:bg-[#2A5751] px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center"
            title="Zoom Out">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />
            </svg>
          </button>
          <button @click="resetZoom"
            class="bg-primary-dark border border-white text-accent-text hover:bg-[#2A5751] px-3 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center"
            title="Reset Zoom">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <ClientOnly>
          <div
            class="rounded-lg border-2 border-white shadow-sm p-4 w-full h-full min-h-[500px] mx-auto flex items-center justify-center bg-[#1E3D38]">
            <canvas v-if="isMounted" ref="chartRef"
              class="w-full h-full transition-opacity duration-300 text-accent-text"
              :class="{ 'opacity-50': loading }" />
          </div>
          <template #fallback>
            <div
              class="rounded-lg border-2 border-white shadow-sm h-[500px] flex items-center justify-center bg-[#1E3D38]">
              <div class="text-center">
                <div
                  class="animate-spin w-8 h-8 border-2 border-[#A3E635] border-t-[#1E3D38] rounded-full mx-auto mb-4">
                </div>
                <p class="text-[#A3E635]">Loading visualization...</p>
              </div>
            </div>
          </template>
        </ClientOnly>
      </div>

      <div class="w-full max-w-[1800px] mx-auto space-y-6 pb-6">
        <ChartStats v-if="isMounted && filteredTasks.length > 0" :filtered-tasks="filteredTasks"
          :time-range="effectiveTimeRange" />
        <ChartLegend v-if="isMounted && chartData.length > 0" :chart-data="chartData" />
      </div>
    </div>
  </div>
</template>