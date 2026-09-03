<template>
  <div v-if="props.inline || props.visible" :class="ui.wrapper" @click.self="handleWrapperClick">
    <div :class="ui.panel">
      <div v-if="pinging" :class="ui.feedback">
        <i class="fa-brands fa-connectdevelop text-white text-3xl animate-bounce"></i>
        <p class="text-[10px] text-stone-600 font-black tracking-[0.3em] uppercase">加载中</p>
      </div>

      <div v-else-if="initError" :class="ui.feedback">
        <div class="relative">
          <i class="fa-solid fa-bomb text-red-500 text-4xl animate-pulse"></i>
          <div class="absolute -inset-2 bg-red-500/20 blur-xl rounded-full"></div>
        </div>
        <div class="text-center px-6">
          <p class="text-stone-200 text-xs font-bold">加载失败</p>
          <p class="text-stone-500 text-[10px] mt-1 line-clamp-2">{{ initError }}</p>
        </div>
        <button
          type="button"
          @click="init"
          class="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-stone-300 text-[10px] font-bold rounded-xl transition-colors"
        >
          重新尝试
        </button>
      </div>

      <div v-else :class="ui.content">
        <div :class="ui.header">
          <div class="space-y-0.5">
            <h2 class="text-sm font-black text-stone-200 uppercase tracking-widest">跑步提醒</h2>
            <p class="text-[9px] text-stone-700 font-mono">{{ nativeLabel }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span :class="['text-[10px] font-black px-2 py-1 rounded-lg border tracking-wide', enabledLabelClass]">
              {{ enabledLabelText }}
            </span>
          </div>
        </div>

        <div :class="ui.fields">
          <div :class="ui.fieldItem">
            <label class="text-[10px] font-black text-stone-600 uppercase tracking-widest ml-1">学校地图</label>
            <div class="relative">
              <div @click="showMapList = !showMapList" :class="ui.mapTrigger">
                <span class="text-[12px] text-stone-200 font-medium">{{ currentMapName }}</span>
                <i
                  :class="[
                    'fa-solid fa-chevron-down text-[10px] text-stone-600 transition-transform',
                    showMapList ? 'rotate-180' : '',
                  ]"
                ></i>
              </div>
              <div
                v-if="showMapList"
                class="absolute z-50 w-full mt-1 bg-stone-900 border border-white/10 rounded-xl shadow-2xl py-1 max-h-[120px] overflow-y-auto"
              >
                <div
                  v-for="map in maps"
                  :key="map.id"
                  @click="selectMap(map)"
                  class="px-4 py-2 text-[12px] text-stone-400 hover:bg-white/5 hover:text-white cursor-pointer transition-colors"
                >
                  {{ map.name }}
                </div>
              </div>
            </div>
          </div>

          <div :class="ui.fieldItem">
            <label class="text-[10px] font-black text-stone-600 uppercase tracking-widest ml-1">提醒时间</label>
            <div class="flex items-center gap-2">
              <div class="flex-1 flex items-center bg-stone-900 border border-white/5 rounded-xl p-1">
                <select
                  v-model="timeObj.h"
                  class="w-full bg-transparent text-center text-sm font-mono text-white outline-none appearance-none py-1"
                >
                  <option v-for="h in 24" :key="h - 1" :value="h - 1" class="bg-stone-900 text-white">
                    {{ String(h - 1).padStart(2, '0') }}
                  </option>
                </select>
                <span class="text-[9px] text-stone-600 pr-2 italic">H</span>
              </div>
              <span class="text-stone-800 font-bold">:</span>
              <div class="flex-1 flex items-center bg-stone-900 border border-white/5 rounded-xl p-1">
                <select
                  v-model="timeObj.m"
                  class="w-full bg-transparent text-center text-sm font-mono text-white outline-none appearance-none py-1"
                >
                  <option v-for="m in 60" :key="m - 1" :value="m - 1" class="bg-stone-900 text-white">
                    {{ String(m - 1).padStart(2, '0') }}
                  </option>
                </select>
                <span class="text-[9px] text-stone-600 pr-2 italic">M</span>
              </div>
            </div>
          </div>

          <div @click="form.enabled = !form.enabled" class="flex items-center justify-between p-1 cursor-pointer group">
            <span class="text-[11px] font-bold text-stone-500 group-hover:text-stone-300 transition-colors">开启每日提醒</span>
            <div
              :class="['w-9 h-5 rounded-full transition-all relative', form.enabled ? 'bg-stone-200' : 'bg-stone-800']"
            >
              <div
                :class="[
                  'absolute top-1 w-3 h-3 rounded-full transition-all',
                  form.enabled ? 'left-5 bg-black' : 'left-1 bg-stone-500',
                ]"
              ></div>
            </div>
          </div>
        </div>

        <button type="button" @click="handleSave" :disabled="submitting" :class="ui.saveButton">
          <i v-if="submitting" class="fa-solid fa-circle-notch fa-spin"></i>
          <span>{{ submitting ? 'SAVING' : '保存提醒' }}</span>
        </button>
      </div>

      <button
        v-if="!props.inline"
        type="button"
        @click="close"
        class="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 text-stone-600 hover:text-white transition-all"
      >
        <i class="fa-solid fa-xmark text-sm"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, inject } from 'vue';
import { loadMapFiles, getMapNames } from '@/utils/map';
import {
  scheduleDailyReminder,
  loadReminderConfig,
  isNativeApp,
} from '@/composables/useReminderNotification';

const props = defineProps({
  visible: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
});
const emit = defineEmits(['update:visible', 'saved']);
const showMessage = inject('showMessage', (msg) => alert(msg));

const nativeApp = isNativeApp();
const nativeLabel = nativeApp ? 'LOCAL REMINDER' : '需在 App 内使用';

const pinging = ref(true);
const initError = ref(null);
const submitting = ref(false);
const showMapList = ref(false);

const maps = ref([]);
const form = ref({ map_id: '', enabled: false });
const timeObj = reactive({ h: 8, m: 0 });

const ui = computed(() =>
  props.inline
    ? {
        wrapper: 'w-full',
        panel: 'relative w-full bg-stone-950 border border-white/10 rounded-lg p-4',
        feedback: 'py-8 flex flex-col items-center justify-center space-y-4',
        content: 'p-4 space-y-4',
        header: 'flex justify-between items-center gap-3',
        fields: 'space-y-3',
        fieldItem: 'space-y-1',
        mapTrigger:
          'flex items-center justify-between bg-stone-900 border border-white/5 rounded-xl px-3 py-2 cursor-pointer hover:border-white/10 transition-all',
        saveButton:
          'w-full bg-stone-800 hover:bg-stone-700 text-stone-200 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-[0.97] disabled:opacity-20 flex items-center justify-center gap-2',
      }
    : {
        wrapper: 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md',
        panel:
          'relative w-full max-w-[300px] bg-stone-950 border border-white/10 rounded-[2rem] shadow-2xl transition-all overflow-hidden',
        feedback: 'py-16 flex flex-col items-center justify-center space-y-4',
        content: 'p-6 space-y-5',
        header: 'flex justify-between items-center gap-3 pr-8',
        fields: 'space-y-4',
        fieldItem: 'space-y-1.5',
        mapTrigger:
          'flex items-center justify-between bg-stone-900 border border-white/5 rounded-xl px-4 py-2.5 cursor-pointer hover:border-white/10 transition-all',
        saveButton:
          'w-full bg-stone-800 hover:bg-stone-700 text-stone-200 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-[0.97] disabled:opacity-20 flex items-center justify-center gap-2',
      },
);

const enabledLabelText = computed(() => (form.value.enabled ? '已开启' : '未开启'));
const enabledLabelClass = computed(() =>
  form.value.enabled
    ? 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'
    : 'text-stone-400 border-stone-600/40 bg-stone-700/20',
);

const currentMapName = computed(() => {
  const selectedId = String(form.value.map_id || '');
  const map = maps.value.find((m) => String(m.id) === selectedId);
  return map ? map.name : 'Loading...';
});

const selectMap = (map) => {
  form.value.map_id = map.id;
  showMapList.value = false;
};

const init = async () => {
  pinging.value = true;
  initError.value = null;

  try {
    const ids = await loadMapFiles();
    const names = getMapNames();
    maps.value = ids.map((id) => ({ id, name: names[id] || id }));

    if (maps.value.length > 0 && !form.value.map_id) {
      form.value.map_id = maps.value[0].id;
    }

    const saved = loadReminderConfig();
    if (saved) {
      timeObj.h = Number(saved.hour) || 8;
      timeObj.m = Number(saved.minute) || 0;
      form.value.enabled = Boolean(saved.enabled);
    }
  } catch (err) {
    console.error('AutoConfig init error:', err);
    initError.value = err.message || 'Unknown error';
  } finally {
    pinging.value = false;
  }
};

const handleSave = async () => {
  if (!nativeApp) {
    showMessage('跑步提醒仅在 App 内可用', 'error');
    return;
  }

  if (!form.value.map_id) {
    showMessage('请选择地图', 'error');
    return;
  }

  submitting.value = true;
  try {
    const result = await scheduleDailyReminder({
      hour: timeObj.h,
      minute: timeObj.m,
      enabled: form.value.enabled,
    });

    if (result.ok) {
      showMessage(result.action === 'scheduled' ? '每日提醒已开启' : '提醒已关闭', 'success');
      emit('saved');
    } else if (result.reason === 'permission_denied') {
      showMessage('通知权限被拒绝，请到系统设置开启', 'error');
    } else if (result.reason === 'schedule_error') {
      showMessage('设置提醒失败，请重试', 'error');
    }
  } catch (err) {
    showMessage(err.message || '保存失败', 'error');
  } finally {
    submitting.value = false;
  }
};

const close = () => {
  showMapList.value = false;
  emit('update:visible', false);
};

const handleWrapperClick = () => {
  if (!props.inline) {
    close();
  }
};

watch(
  () => ({ visible: props.visible, inline: props.inline }),
  (current, previous) => {
    const shouldInitInline = current.inline && !previous?.inline;
    const shouldInitModal = current.visible && !previous?.visible;
    if (shouldInitInline || shouldInitModal) {
      init();
    }
  },
  { immediate: true },
);
</script>

<style scoped>
select {
  -webkit-appearance: none;
  -moz-appearance: none;
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #292524;
  border-radius: 10px;
}

option {
  background-color: #0c0a09;
  color: #e7e5e4;
}
</style>
