<template>
    <div class="bg-[#1E3D38] border border-slate-600 rounded-lg p-6 mb-6">
        <h3 class="text-[#A3E635] text-lg font-semibold mb-4">Analysis Configuration</h3>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Process type filter -->
            <div>
                <label class="block text-[#A3E635] text-sm font-medium mb-3">
                    Process types to show:
                </label>
                <div class="space-y-2">
                    <label class="flex items-center">
                        <input type="checkbox" v-model="localConfig.showAll" @change="toggleShowAll"
                            class="mr-2 rounded border-slate-500 bg-slate-700 text-[#A3E635] focus:ring-[#A3E635]">
                        <span class="text-slate-200">All</span>
                    </label>
                    <div class="pl-4 space-y-2">
                        <label v-for="type in availableTypes" :key="type" class="flex items-center">
                            <input type="checkbox" v-model="localConfig.selectedTypes" :value="type"
                                :disabled="localConfig.showAll"
                                class="mr-2 rounded border-slate-500 bg-slate-700 text-[#A3E635] focus:ring-[#A3E635]">
                            <span class="text-slate-200 capitalize">{{ type.toLowerCase() }}</span>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Time filter -->
            <div>
                <label class="block text-[#A3E635] text-sm font-medium mb-3">
                    Time frame:
                </label>
                <div class="space-y-3">
                    <label class="flex items-center">
                        <input type="radio" v-model="localConfig.timeMode" value="all"
                            class="mr-2 border-slate-500 bg-slate-700 text-[#A3E635] focus:ring-[#A3E635]">
                        <span class="text-slate-200">Entire period</span>
                    </label>
                    <label class="flex items-center">
                        <input type="radio" v-model="localConfig.timeMode" value="custom"
                            class="mr-2 border-slate-500 bg-slate-700 text-[#A3E635] focus:ring-[#A3E635]">
                        <span class="text-slate-200">Custom range</span>
                    </label>

                    <div v-if="localConfig.timeMode === 'custom'" class="pl-6 space-y-2">
                        <div>
                            <label class="block text-sm text-slate-300 mb-1">Start time (minutes):</label>
                            <input type="number" v-model.number="localConfig.startTime" :min="minTime" :max="maxTime"
                                step="0.000001"
                                class="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded text-slate-200 focus:ring-[#A3E635] focus:border-[#A3E635]">
                        </div>
                        <div>
                            <label class="block text-sm text-slate-300 mb-1">End time (minutes):</label>
                            <input type="number" v-model.number="localConfig.endTime" :min="minTime" :max="maxTime"
                                step="0.000001"
                                class="w-full px-3 py-2 bg-slate-700 border border-slate-500 rounded text-slate-200 focus:ring-[#A3E635] focus:border-[#A3E635]">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-600">
            <button @click="applyConfig"
                class="bg-[#A3E635] text-slate-900 px-4 py-2 rounded-lg font-medium hover:bg-lime-400 transition-colors">
                Apply Configuration
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
    availableTypes: {
        type: Array,
        required: true
    },
    minTime: {
        type: Number,
        required: true
    },
    maxTime: {
        type: Number,
        required: true
    },
    config: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['config-change']);

const localConfig = ref({
    showAll: props.config.showAll,
    selectedTypes: [...props.config.selectedTypes],
    timeMode: props.config.timeMode,
    startTime: 0,
    endTime: props.config.endTime
});

const toggleShowAll = () => {
    if (localConfig.value.showAll) {
        localConfig.value.selectedTypes = [...props.availableTypes];
    }
};

const applyConfig = () => {
    // Validate time range
    if (localConfig.value.timeMode === 'custom') {
        if (localConfig.value.startTime >= localConfig.value.endTime) {
            alert('Start time must be less than end time');
            return;
        }
    }

    emit('config-change', { ...localConfig.value });
};

// Sincronizar cambios en props
watch(() => props.config, (newConfig) => {
    localConfig.value = {
        showAll: newConfig.showAll,
        selectedTypes: [...newConfig.selectedTypes],
        timeMode: newConfig.timeMode,
        startTime: newConfig.startTime,
        endTime: newConfig.endTime
    };
}, { deep: true });
</script>
