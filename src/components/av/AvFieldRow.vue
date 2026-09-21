<template>
  <BaseRow :name="field.name" :icon="iconName">
    <template v-if="field.type === 'select'">
      <t-select
        v-model="selectName"
        :borderless="true"
        :clearable="true"
        :disabled="!field.editable || saving"
        :placeholder="placeholders.select"
        @change="submit"
      >
        <t-option
          v-for="item in field.options"
          :key="item.name"
          :value="item.name"
          :label="item.name"
        />
      </t-select>
    </template>

    <template v-else-if="field.type === 'mSelect'">
      <t-select
        v-model="multiSelectNames"
        :borderless="true"
        :clearable="true"
        :disabled="!field.editable || saving"
        multiple
        :placeholder="placeholders.select"
        @change="submit"
      >
        <t-option
          v-for="item in field.options"
          :key="item.name"
          :value="item.name"
          :label="item.name"
        />
      </t-select>
    </template>

    <template v-else-if="field.type === 'text' || field.type === 'url' || field.type === 'email' || field.type === 'phone'">
      <t-input
        v-model="textModel"
        :borderless="true"
        :disabled="!field.editable || saving"
        :placeholder="placeholders.input"
        @blur="submit"
      />
    </template>

    <template v-else-if="field.type === 'number'">
      <t-input-number
        v-model="numberModel"
        :borderless="true"
        :disabled="!field.editable || saving"
        :placeholder="placeholders.input"
        @blur="submit"
        @enter="submit"
      />
    </template>

    <template v-else-if="field.type === 'date' && field.value.date?.hasEndDate">
      <t-date-range-picker
        :value="dateRange"
        :borderless="true"
        :clearable="true"
        :disabled="!field.editable || saving"
        :enable-time-picker="!field.value.date?.isNotTime"
        :placeholder="placeholders.select"
        value-type="time-stamp"
        @change="onDateRangeChange"
      />
    </template>

    <template v-else-if="field.type === 'date'">
      <t-date-picker
        :value="dateValue"
        :borderless="true"
        :clearable="true"
        :disabled="!field.editable || saving"
        :enable-time-picker="!field.value.date?.isNotTime"
        :placeholder="placeholders.select"
        value-type="time-stamp"
        @change="onDateChange"
      />
    </template>

    <template v-else-if="field.type === 'checkbox'">
      <t-checkbox
        v-model="checkedModel"
        :disabled="!field.editable || saving"
        @change="submit"
      />
    </template>

    <template v-else-if="field.type === 'block'">
      <t-input :value="field.value.blockContent" :borderless="true" readonly />
    </template>

    <template v-else>
      <t-input :value="readonlyDisplay" :borderless="true" :placeholder="placeholders.unsupported" readonly />
    </template>
  </BaseRow>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { MessagePlugin } from "tdesign-vue-next";
import type { DatabaseField, DatabaseOption } from "@/models/attributeView";
import BaseRow from "@/components/BaseRow.vue";
import { getI18nText } from "@/services/i18n";
import { useDatabasePanelStore } from "@/store/databasePanel";

const props = defineProps<{
  field: DatabaseField;
}>();

const store = useDatabasePanelStore();
const saving = computed(() => store.isSaving);

const placeholders = computed(() => ({
  select: getI18nText("databasePanel.placeholderSelect", "请选择"),
  input: getI18nText("databasePanel.placeholderInput", "请输入"),
  unsupported: getI18nText("databasePanel.unsupported", "暂不支持在面板中编辑"),
}));

const iconByType: Record<string, string> = {
  text: "view-list",
  select: "chevron-down-s",
  url: "link",
  email: "mail",
  phone: "call",
  number: "add-and-subtract",
  mSelect: "chevron-down-double-s",
  date: "calendar-event",
  checkbox: "check",
  template: "sum",
  relation: "link",
  rollup: "sum",
  mAsset: "image",
  created: "calendar",
  updated: "calendar",
  block: "file",
};

const iconName = computed(() => iconByType[props.field.type] || props.field.icon || "view-list");

const draft = ref<DatabaseField>(cloneField(props.field));

watch(
  () => props.field,
  (next) => {
    draft.value = cloneField(next);
  },
  { deep: true },
);

function cloneField(field: DatabaseField): DatabaseField {
  return {
    ...field,
    options: field.options.map((o) => ({ ...o })),
    value: {
      ...field.value,
      options: field.value.options.map((o) => ({ ...o })),
      date: field.value.date ? { ...field.value.date } : undefined,
      raw: { ...field.value.raw },
    },
  };
}

const selectName = computed({
  get: () => draft.value.value.options[0]?.name ?? "",
  set: (name: string) => {
    draft.value.value.options = name ? [optionFromName(name)] : [];
  },
});

const multiSelectNames = computed({
  get: () => draft.value.value.options.map((o) => o.name),
  set: (names: string[]) => {
    draft.value.value.options = (names ?? []).map(optionFromName);
  },
});

const textModel = computed({
  get: () => {
    if (draft.value.type === "url") return draft.value.value.url;
    if (draft.value.type === "email") return draft.value.value.email;
    if (draft.value.type === "phone") return draft.value.value.phone;
    return draft.value.value.text;
  },
  set: (v: string) => {
    if (draft.value.type === "url") draft.value.value.url = v;
    else if (draft.value.type === "email") draft.value.value.email = v;
    else if (draft.value.type === "phone") draft.value.value.phone = v;
    else draft.value.value.text = v;
  },
});

const numberModel = computed({
  get: () => draft.value.value.number,
  set: (v: number | undefined) => {
    draft.value.value.number = typeof v === "number" && Number.isFinite(v) ? v : undefined;
  },
});

const checkedModel = computed({
  get: () => draft.value.value.checked,
  set: (v: boolean) => {
    draft.value.value.checked = Boolean(v);
  },
});

const dateValue = computed(() => draft.value.value.date?.content);
const dateRange = computed(() => {
  const d = draft.value.value.date;
  if (!d?.content) return [];
  return [d.content, d.content2 ?? d.content];
});

function optionFromName(name: string): DatabaseOption {
  const fromKey = draft.value.options.find((o) => o.name === name);
  return { name, color: fromKey?.color ?? "1" };
}

function onDateChange(value: number | undefined) {
  if (value === undefined || value === null) {
    draft.value.value.date = { hasEndDate: false, isNotTime: true, isNotEmpty: false };
  } else {
    draft.value.value.date = {
      content: value,
      hasEndDate: false,
      isNotTime: draft.value.value.date?.isNotTime ?? true,
      isNotEmpty: true,
    };
  }
  void submit();
}

function onDateRangeChange(value: number[] | undefined) {
  if (!value || value.length < 1) {
    draft.value.value.date = { hasEndDate: true, isNotTime: true, isNotEmpty: false };
  } else {
    draft.value.value.date = {
      content: value[0],
      content2: value[1],
      hasEndDate: true,
      isNotTime: draft.value.value.date?.isNotTime ?? true,
      isNotEmpty: true,
    };
  }
  void submit();
}

const readonlyDisplay = computed(() => {
  if (draft.value.type === "template") return draft.value.value.template;
  return "";
});

async function submit(): Promise<void> {
  if (!draft.value.editable || saving.value) return;
  try {
    await store.saveField(draft.value);
  } catch (error) {
    MessagePlugin.error(error instanceof Error ? error.message : String(error));
    draft.value = cloneField(props.field);
    await store.load().catch(() => undefined);
  }
}
</script>
