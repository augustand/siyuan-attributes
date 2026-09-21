<template>
  <div class="mux-database-panel-root">
    <div v-if="isLoading" class="mux-db-empty">{{ labels.loading }}</div>

    <div v-else-if="loadError" class="mux-db-empty">{{ loadError }}</div>

    <div v-else-if="panels.length === 0" class="mux-db-empty">{{ labels.empty }}</div>

    <template v-else>
      <div class="mux-db-toolbar">
        <t-tabs
          v-if="panels.length > 1"
          :value="activeAvID"
          size="medium"
          @change="onTabChange"
        >
          <t-tab-panel
            v-for="panel in panels"
            :key="panel.avID"
            :value="panel.avID"
            :label="panel.avName"
          />
        </t-tabs>

        <div class="mux-db-actions">
          <t-checkbox
            :checked="activePrefs.hideEmpty"
            @change="onHideEmptyChange"
          >
            {{ labels.hideEmpty }}
          </t-checkbox>

          <t-popup trigger="click" placement="bottom-right">
            <t-button size="small" variant="text">{{ labels.columns }}</t-button>
            <template #content>
              <div class="mux-db-column-menu">
                <t-checkbox
                  :checked="!activePrefs.hidePrimaryKey"
                  @change="onShowPrimaryChange"
                >
                  {{ labels.showPrimary }}
                </t-checkbox>
                <t-checkbox-group
                  :value="visibleKeyIDs"
                  @change="onVisibleKeysChange"
                >
                  <t-checkbox
                    v-for="field in allFieldsForMenu"
                    :key="field.keyID"
                    :value="field.keyID"
                    :label="field.name"
                  />
                </t-checkbox-group>
              </div>
            </template>
          </t-popup>
        </div>
      </div>

      <div v-if="visibleFields.length === 0" class="mux-db-empty">{{ labels.noVisible }}</div>
      <AvFieldRow
        v-for="field in visibleFields"
        :key="field.keyID"
        :field="field"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { MessagePlugin } from "tdesign-vue-next";
import AvFieldRow from "@/components/av/AvFieldRow.vue";
import { getI18nText } from "@/services/i18n";
import { useDatabasePanelStore } from "@/store/databasePanel";

const store = useDatabasePanelStore();
const {
  panels,
  activeAvID,
  activePrefs,
  visibleFields,
  isLoading,
  loadError,
} = storeToRefs(store);

const labels = computed(() => ({
  loading: getI18nText("databasePanel.loading", "加载中…"),
  empty: getI18nText(
    "databasePanel.empty",
    "将此文档加入数据库后即可在此编辑字段",
  ),
  hideEmpty: getI18nText("databasePanel.hideEmpty", "隐藏空字段"),
  columns: getI18nText("databasePanel.columns", "列设置"),
  showPrimary: getI18nText("databasePanel.showPrimary", "显示主键"),
  noVisible: getI18nText("databasePanel.noVisible", "当前没有可显示的字段"),
}));

const allFieldsForMenu = computed(() => {
  const fields = store.activePanel?.fields ?? [];
  return fields.filter((f) => f.type !== "block");
});

const visibleKeyIDs = computed(() => {
  const hidden = new Set(activePrefs.value.hiddenKeyIDs);
  return allFieldsForMenu.value.map((f) => f.keyID).filter((id) => !hidden.has(id));
});

function onTabChange(value: string | number) {
  store.setActiveAv(String(value));
}

async function onHideEmptyChange(checked: boolean) {
  if (!activeAvID.value) return;
  try {
    await store.updateAvPrefs(activeAvID.value, { hideEmpty: checked });
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : String(error));
  }
}

async function onShowPrimaryChange(checked: boolean) {
  if (!activeAvID.value) return;
  try {
    await store.updateAvPrefs(activeAvID.value, { hidePrimaryKey: !checked });
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : String(error));
  }
}

async function onVisibleKeysChange(values: string[]) {
  if (!activeAvID.value) return;
  const selected = new Set(values ?? []);
  const hiddenKeyIDs = allFieldsForMenu.value
    .map((f) => f.keyID)
    .filter((id) => !selected.has(id));
  try {
    await store.updateAvPrefs(activeAvID.value, { hiddenKeyIDs });
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : String(error));
  }
}

onMounted(() => {
  void store.load().catch((error) => {
    MessagePlugin.error(error instanceof Error ? error.message : String(error));
  });
});

watch(activeAvID, () => {
  // prefs are reactive via settings store
});
</script>

<style scoped>
.mux-database-panel-root {
  padding: 4px 0 8px;
}

.mux-db-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.mux-db-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.mux-db-empty {
  color: var(--b3-theme-on-surface-light, #666);
  font-size: 13px;
  padding: 8px 4px;
}

.mux-db-column-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  min-width: 180px;
  max-height: 280px;
  overflow: auto;
}
</style>
