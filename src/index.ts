import { Plugin, Setting } from "siyuan";
import type { App as VueApp } from "vue";
import "@/index.scss";

import { createApp } from "vue";
import { createPinia } from "pinia";
import "tdesign-vue-next/es/style/index.css";
import SettingPage from "./views/SettingPage.vue";
import DocDatabaseDock from "./views/DocDatabaseDock.vue";

/**
 * Document × database manager.
 * Field editing under the title is left to SiYuan's native AV UI.
 */
export default class PluginSample extends Plugin {
  private settingApp?: VueApp<Element>;
  private settingPageDiv?: HTMLDivElement;
  private dockApp?: VueApp<Element>;

  private initializeSettingDialog(): void {
    this.settingPageDiv = document.createElement("div");
    this.settingPageDiv.className = "mux-plugin-settings";
    this.settingPageDiv.style.height = "100%";

    this.settingApp = createApp(SettingPage);
    this.settingApp.provide("$plugin", this);
    this.settingApp.use(createPinia());
    this.settingApp.mount(this.settingPageDiv);

    this.setting = new Setting({
      width: "720px",
      height: "70vh",
    });
    this.setting.addItem({
      title: "文档数据库",
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

  async onload() {
    this.addIcons(`<symbol id="iconDocDatabase" viewBox="0 0 24 24">
      <path fill="currentColor" d="M4 4h16v4H4V4Zm0 6h16v10H4V10Zm2 2v6h12v-6H6Z"/>
    </symbol>`);

    this.addTopBar({
      icon: "iconDocDatabase",
      title: "文档数据库",
      position: "right",
      callback: () => this.openSettingUI(),
    });

    this.addDock({
      config: {
        position: "RightTop",
        size: { width: 320, height: 0 },
        icon: "iconDocDatabase",
        title: "文档数据库",
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
        this.dockApp.mount(host);
      },
      destroy: () => {
        this.dockApp?.unmount();
        this.dockApp = undefined;
      },
    });
  }

  async onunload() {
    this.dockApp?.unmount();
    this.dockApp = undefined;
    this.settingApp?.unmount();
    this.settingApp = undefined;
    this.settingPageDiv?.remove();
    this.settingPageDiv = undefined;
  }
}
