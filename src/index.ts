import { Plugin, Setting, showMessage } from "siyuan";
import type { App as VueApp } from "vue";
import "@/index.scss";

import { createApp } from "vue";
import { createPinia } from "pinia";
import "tdesign-vue-next/es/style/index.css";
import SettingPage from "./views/SettingPage.vue";
import DocDatabaseDock from "./views/DocDatabaseDock.vue";
import DoctreeClassifyHost from "./views/DoctreeClassifyHost.vue";
import CaptureHost from "./views/CaptureHost.vue";
import {
  DEFAULT_TABLE_TEMPLATES,
  type TableTemplate,
} from "./models/databaseTypes";
import { displayOwnedDatabaseName } from "./models/ownedDatabaseHang";
import { joinTableByKey } from "./services/doctreeClassify";
import { getActiveDocumentId } from "./services/ownedDatabase";
import { getI18nText, setI18n } from "./services/i18n";
import { CAPTURE_EVENT, CLASSIFY_PICK_TABLE_EVENT } from "./services/doctreeClassifyEvents";

/**
 * Document × database manager.
 * Field editing under the title is left to SiYuan's native AV UI.
 * Doctree classify registers on plugin.eventBus (not Dock / Vue inject).
 */
export default class PluginSample extends Plugin {
  private settingApp?: VueApp<Element>;
  private settingPageDiv?: HTMLDivElement;
  private dockApp?: VueApp<Element>;
  private classifyApp?: VueApp<Element>;
  private classifyHost?: HTMLDivElement;
  private captureApp?: VueApp<Element>;
  private captureHost?: HTMLDivElement;

  private initializeSettingDialog(): void {
    this.settingPageDiv = document.createElement("div");
    this.settingPageDiv.className = "mux-plugin-settings";
    this.settingPageDiv.style.height = "100%";

    this.settingApp = createApp(SettingPage);
    this.settingApp.provide("$plugin", this);
    this.settingApp.use(createPinia());
    setI18n(this.i18n as Record<string, unknown> | undefined);
    this.settingApp.mount(this.settingPageDiv);

    this.setting = new Setting({
      width: "720px",
      height: "70vh",
    });
    this.setting.addItem({
      title: getI18nText("settings.title", "文档数据库"),
      createActionElement: () => this.settingPageDiv!,
    });
  }

  private ensureSettingDialog(): void {
    if (!this.settingApp || !this.settingPageDiv) {
      this.initializeSettingDialog();
    }
  }

  private openSettingUI(): void {
    this.ensureSettingDialog();
    this.openSetting();
  }

  private mountClassifyHost(): void {
    if (this.classifyApp) return;
    const parent = document.body ?? document.documentElement;
    this.classifyHost = document.createElement("div");
    this.classifyHost.className = "mux-doctree-classify-host";
    parent.appendChild(this.classifyHost);
    this.classifyApp = createApp(DoctreeClassifyHost);
    this.classifyApp.provide("$plugin", this);
    this.classifyApp.use(createPinia());
    setI18n(this.i18n as Record<string, unknown> | undefined);
    this.classifyApp.mount(this.classifyHost);

    this.captureHost = document.createElement("div");
    this.captureHost.className = "mux-capture-host";
    parent.appendChild(this.captureHost);
    this.captureApp = createApp(CaptureHost);
    this.captureApp.provide("$plugin", this);
    this.captureApp.use(createPinia());
    setI18n(this.i18n as Record<string, unknown> | undefined);
    this.captureApp.mount(this.captureHost);
  }

  private onDoctreeMenu = (event: CustomEvent): void => {
    const detail = event.detail as {
      menu?: { addItem: (item: Record<string, unknown>) => void };
      type?: string;
      items?: Array<{ id: string }>;
      elements?: NodeListOf<HTMLElement>;
    };
    // SiYuan uses doc / docs / items for document nodes
    if (
      detail.type !== "doc"
      && detail.type !== "docs"
      && detail.type !== "items"
    ) {
      return;
    }
    if (!detail.menu?.addItem) return;

    const ids =
      detail.items?.map((i) => i.id).filter(Boolean)
      ?? Array.from(detail.elements ?? [])
        .map((el) => el.getAttribute("data-node-id") || el.dataset.nodeId || "")
        .filter(Boolean);
    if (!ids.length) return;

    for (const template of DEFAULT_TABLE_TEMPLATES) {
      detail.menu.addItem({
        icon: "iconDocDatabase",
        label: getI18nText(template.nameKey, template.nameFallback),
        click: () => {
          void this.joinTablesFromMenu(ids, template);
        },
      });
    }
    detail.menu.addItem({
      icon: "iconDocDatabase",
      label: getI18nText("ownedDb.menuJoinMore", "更多表格…"),
      click: () => {
        window.dispatchEvent(
          new CustomEvent(CLASSIFY_PICK_TABLE_EVENT, {
            detail: { docId: ids[0]! },
          }),
        );
      },
    });
  };

  /** Join EVERY selected document; single selection keeps the rich toasts. */
  private async joinTablesFromMenu(
    docIds: string[],
    template: TableTemplate,
  ): Promise<void> {
    if (docIds.length <= 1) {
      await this.joinTableFromMenu(docIds[0] ?? "", template);
      return;
    }
    let joined = 0;
    let addedColumns: string[] = [];
    try {
      for (const docId of docIds) {
        const result = await joinTableByKey({
          plugin: this,
          docId,
          templateKey: template.key,
          nameOf: (tpl) => getI18nText(tpl.nameKey, tpl.nameFallback),
        });
        if (result.kind !== "already") joined += 1;
        if (!addedColumns.length && result.addedColumns.length) {
          addedColumns = result.addedColumns;
        }
      }
    } catch (e) {
      showMessage(e instanceof Error ? e.message : String(e), 5000, "error");
      return;
    }
    if (addedColumns.length) {
      showMessage(
        getI18nText("ownedDb.columnsAdded", "已补齐字段：{cols}").replace(
          "{cols}",
          addedColumns.join("、"),
        ),
        3000,
        "info",
      );
    }
    showMessage(
      getI18nText("ownedDb.batchJoinOk", "已加入 {n} 篇").replace(
        "{n}",
        String(joined),
      ),
      3000,
      "info",
    );
  }

  private async joinTableFromMenu(
    docId: string,
    template: TableTemplate,
  ): Promise<void> {
    try {
      const result = await joinTableByKey({
        plugin: this,
        docId,
        templateKey: template.key,
        nameOf: (tpl) => getI18nText(tpl.nameKey, tpl.nameFallback),
      });
      if (result.addedColumns.length) {
        showMessage(
          getI18nText("ownedDb.columnsAdded", "已补齐字段：{cols}").replace(
            "{cols}",
            result.addedColumns.join("、"),
          ),
          3000,
          "info",
        );
      }
      if (result.kind === "already") {
        showMessage(
          getI18nText("ownedDb.alreadyBound", "文档已在该库中"),
          2000,
          "info",
        );
        return;
      }
      const label = getI18nText(template.nameKey, template.nameFallback);
      const name = displayOwnedDatabaseName(result.db.name, label);
      showMessage(
        getI18nText(
          result.kind === "created" ? "ownedDb.createdJoin" : "ownedDb.joinOk",
          result.kind === "created"
            ? `已生成并加入「${name}」`
            : `已加入「${name}」`,
        ).replace("{name}", name),
        3000,
        "info",
      );
    } catch (e) {
      showMessage(e instanceof Error ? e.message : String(e), 5000, "error");
    }
  }

  async onload() {
    setI18n(this.i18n as Record<string, unknown> | undefined);

    this.addIcons(`<symbol id="iconDocDatabase" viewBox="0 0 24 24">
      <path fill="currentColor" d="M4 4h16v4H4V4Zm0 6h16v10H4V10Zm2 2v6h12v-6H6Z"/>
    </symbol>
    <symbol id="iconQuickCapture" viewBox="0 0 24 24">
      <path fill="currentColor" d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3Z"/>
    </symbol>`);

    this.addTopBar({
      icon: "iconDocDatabase",
      title: getI18nText("settings.title", "文档数据库"),
      position: "right",
      callback: () => this.openSettingUI(),
    });

    this.addTopBar({
      icon: "iconQuickCapture",
      title: getI18nText("ownedDb.capture", "记一条到收集箱"),
      position: "right",
      callback: () => window.dispatchEvent(new CustomEvent(CAPTURE_EVENT)),
    });

    // Command palette entries — hotkeys are bound by the user in SiYuan settings.
    for (const template of DEFAULT_TABLE_TEMPLATES) {
      const label = getI18nText("ownedDb.cmdJoinPrefix", "加入「{name}」").replace(
        "{name}",
        getI18nText(template.nameKey, template.nameFallback),
      );
      this.addCommand({
        langKey: `joinTable-${template.key}`,
        langText: label,
        hotkey: "",
        callback: () => {
          const docId = getActiveDocumentId();
          if (!docId) {
            showMessage(
              getI18nText("ownedDb.needDoc", "请先打开一篇文档"),
              3000,
              "info",
            );
            return;
          }
          void this.joinTableFromMenu(docId, template);
        },
      });
    }

    // Register on plugin bus directly — do not depend on Vue inject / Dock mount.
    this.eventBus.on("open-menu-doctree", this.onDoctreeMenu);

    this.addDock({
      config: {
        position: "RightTop",
        size: { width: 320, height: 0 },
        icon: "iconDocDatabase",
        title: getI18nText("settings.title", "文档数据库"),
      },
      data: { text: "DocDatabase" },
      type: "mux-doc-database-dock",
      init: (dock) => {
        const host = document.createElement("div");
        host.style.height = "100%";
        host.style.overflow = "auto";
        dock.element.append(host);
        this.dockApp?.unmount();
        this.dockApp = createApp(DocDatabaseDock);
        this.dockApp.provide("$plugin", this);
        this.dockApp.provide("$EventBus", this.eventBus);
        this.dockApp.use(createPinia());
        setI18n(this.i18n as Record<string, unknown> | undefined);
        this.dockApp.mount(host);
      },
      destroy: () => {
        this.dockApp?.unmount();
        this.dockApp = undefined;
      },
    });
  }

  async onLayoutReady() {
    // Create dialog host after layout exists (body ready).
    this.mountClassifyHost();
  }

  async onunload() {
    this.eventBus.off("open-menu-doctree", this.onDoctreeMenu);
    this.dockApp?.unmount();
    this.dockApp = undefined;
    this.classifyApp?.unmount();
    this.classifyApp = undefined;
    this.classifyHost?.remove();
    this.classifyHost = undefined;
    this.captureApp?.unmount();
    this.captureApp = undefined;
    this.captureHost?.remove();
    this.captureHost = undefined;
    this.settingApp?.unmount();
    this.settingApp = undefined;
    this.settingPageDiv?.remove();
    this.settingPageDiv = undefined;
  }
}
