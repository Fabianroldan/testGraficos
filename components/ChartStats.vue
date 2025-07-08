<template>
    <div class="bg-[#1E3D38] border-2 border-white rounded-lg p-6 mt-4 w-full max-w-[1800px] mx-auto">
        <h3 class="text-lg font-semibold text-[#A3E635] mb-4 flex items-center justify-center gap-2">
            Statistics for Selected Range
        </h3>

        <div class="flex justify-center">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full">
                <div class="bg-slate-700/30 rounded-lg p-5 border border-white/50">
                    <div class="text-sm text-slate-300 mb-2">Time Range Used</div>
                    <div class="text-2xl font-bold text-[#A3E635]">{{ timeRangeFilteredInSeconds }}</div>
                    <div class="text-xs text-slate-400 mt-2">{{ formattedTimeRangeFiltered }}</div>
                </div>

                <div class="bg-slate-700/30 rounded-lg p-5 border border-white/50">
                    <div class="text-sm text-slate-300 mb-2">Total Task Duration</div>
                    <div class="text-2xl font-bold text-blue-400">{{ totalDurationInSeconds }} s</div>
                    <div class="text-xs text-slate-400 mt-2">{{ formattedTotalDuration }}</div>
                </div>

                <div class="bg-slate-700/30 rounded-lg p-5 border border-white/50">
                    <div class="text-sm text-slate-300 mb-2">Tasks in Range</div>
                    <div class="text-2xl font-bold text-purple-400">{{ taskCount }}</div>
                    <div class="text-xs text-slate-400 mt-2">{{ uniqueTypesCount }} unique types</div>
                </div>
            </div>
        </div>

        <div class="mt-6 flex justify-center" v-if="typeBreakdown.length > 0">
            <div class="w-full max-w-4xl border border-white rounded-lg bg-slate-700/20 p-4">
                <h4 class="text-md font-medium text-[#A3E635] mb-3 text-center">Type Breakdown</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div v-for="type in typeBreakdown" :key="type.name"
                        class="bg-slate-700/20 rounded-lg p-3 border border-slate-600/30">
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-medium text-white">{{ type.name }}</span>
                            <span class="text-sm font-bold" :style="{ color: type.color || '#A3E635' }">
                                {{ type.percentage }}%
                            </span>
                        </div>
                        <div class="text-sm text-slate-300 space-y-1">
                            <div>Duration: {{ type.formattedDuration }}</div>
                            <div>Tasks: {{ type.count }}</div>
                            <div class="w-full bg-slate-600 rounded-full h-2">
                                <div class="h-2 rounded-full transition-all duration-300"
                                    :style="{ width: type.percentage + '%', backgroundColor: type.color || '#A3E635' }">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    filteredTasks: {
        type: Array,
        required: true,
        default: () => []
    },
    timeRange: {
        type: Object,
        required: true,
        default: () => ({ min: 0, max: 0 })
    }
});

const totalDurationSum = computed(() => {
    return props.filteredTasks.reduce((sum, task) => {
        return sum + task.segments.reduce((segSum, segment) => segSum + segment.duration, 0);
    }, 0);
});

const taskCount = computed(() => props.filteredTasks.length);

const uniqueTypesCount = computed(() => {
    const types = new Set(props.filteredTasks.map(task => task.type));
    return types.size;
});

const totalDurationInSeconds = computed(() => {
    return (totalDurationSum.value / 1_000_000).toFixed(3);
});

const timeRangeFilteredInSeconds = computed(() => {
    const rangeMicros = (props.timeRange.max - props.timeRange.min) * 60_000_000;
    const rangeSeconds = rangeMicros / 1_000_000;
    
    if (rangeSeconds >= 60) {
        const rangeMinutes = rangeSeconds / 60;
        return `${rangeMinutes.toFixed(2)} min`;
    }
    
    return `${rangeSeconds.toFixed(3)} s`;
});

const formattedTimeRangeFiltered = computed(() => {
    const rangeMicros = (props.timeRange.max - props.timeRange.min) * 60_000_000;
    return formatTime(rangeMicros);
});

const formatTime = (time) => {
    if (time >= 1_000_000) {
        return `${(time / 1_000_000).toFixed(3)}s`;
    } else if (time >= 1_000) {
        return `${(time / 1_000).toFixed(3)}ms`;
    } else {
        return `${time.toFixed(0)}μs`;
    }
};

const formattedTotalDuration = computed(() => formatTime(totalDurationSum.value));

const typeBreakdown = computed(() => {
    if (!props.filteredTasks.length) return [];

    const typeStats = {};

    props.filteredTasks.forEach(task => {
        const type = task.type;
        if (!typeStats[type]) {
            typeStats[type] = {
                duration: 0,
                count: 0,
                color: task.colorScheme.primary
            };
        }
        typeStats[type].duration += task.segments.reduce((sum, seg) => sum + seg.duration, 0);
        typeStats[type].count++;
    });

    const total = totalDurationSum.value;

    return Object.entries(typeStats)
        .map(([name, stats]) => ({
            name,
            duration: stats.duration,
            count: stats.count,
            percentage: total > 0 ? ((stats.duration / total) * 100).toFixed(1) : '0.0',
            formattedDuration: formatTime(stats.duration),
            color: stats.color
        }))
        .sort((a, b) => b.duration - a.duration);
});
</script>