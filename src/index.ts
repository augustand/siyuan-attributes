import { Plugin, Setting } from "siyuan";
import type { App as VueApp } from "vue";
import type { IProtyle } from "siyuan";
import "@/index.scss";

// Vue
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "tdesign-vue-next/es/style/index.css";
import SettingPage from "./views/SettingPage.vue";
import { PanelRegistry } from "@/services/panelRegistry";

export default class PluginSample extends Plugin {
  private readonly panelRegistry = new PanelRegistry();
  private settingApp?: VueApp<Element>;
  private settingPageDiv?: HTMLDivElement;

  private initializeSettingDialog(): void {
    this.settingPageDiv = document.createElement("div");
    this.settingPageDiv.className = "mux-plugin-settings";
    this.settingPageDiv.style.height = "100%";

    this.settingApp = createApp(SettingPage);
    this.settingApp.provide("$plugin", this);
    const pinia = createPinia();
    this.settingApp.use(pinia);
    this.settingApp.mount(this.settingPageDiv);

    this.setting = new Setting({
      width: "1080px",
      height: "78vh",
    });
    this.setting.addItem({
      title: "属性面板设置",
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

  private readonly handleLoadedProtyle = (event: { detail: { protyle: IProtyle } }) => {
    this.mountAttributePanel(event.detail.protyle);
  };

  private readonly handleDestroyProtyle = (event: { detail: { protyle: IProtyle } }) => {
    const docId = event.detail?.protyle?.block?.id;
    if (docId) this.panelRegistry.unmount(docId);
  };

  async onload() {
    this.addIcons(`<symbol id="iconAttributePanelSettings" viewBox="0 0 24 24">
      <path fill="currentColor" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm7.4-3.5c0 .5 0 1-.1 1.4l2.1 1.7-2 3.4-2.5-1a7.6 7.6 0 0 1-2.4 1.4l-.4 2.6h-4l-.4-2.6a7.6 7.6 0 0 1-2.4-1.4l-2.5 1-2-3.4 2.1-1.7a8 8 0 0 1 0-2.8L2.8 9.9l2-3.4 2.5 1c.7-.6 1.5-1 2.4-1.4L10.1 3h4l.4 2.6c.9.4 1.7.8 2.4 1.4l2.5-1 2 3.4-2.1 1.7c.1.4.1.9.1 1.4Z"/>
    </symbol>`);

    this.addTopBar({
      icon: "iconAttributePanelSettings",
      title: "属性面板设置",
      position: "right",
      callback: () => this.openSettingUI(),
    });
  }

  onLayoutReady() {
    this.eventBus.on("loaded-protyle-static", this.handleLoadedProtyle);
    this.eventBus.on("destroy-protyle", this.handleDestroyProtyle);
  }

  async onunload() {
    this.eventBus.off("loaded-protyle-static", this.handleLoadedProtyle);
    this.eventBus.off("destroy-protyle", this.handleDestroyProtyle);
    this.panelRegistry.unmountAll();
    this.settingApp?.unmount();
    this.settingApp = undefined;
    this.settingPageDiv?.remove();
    this.settingPageDiv = undefined;
  }

  private mountAttributePanel(openedProtyle: IProtyle) {
    const docId = openedProtyle.block.id;

    // 本来想限制只有id开头为20才是完整id, 后来想了想还是为能够活到2100的人提供支持吧嘿嘿
    if (!docId || !docId.startsWith("2")) return;
    if (this.panelRegistry.isConnected(docId)) return;

    const parentNode = document.querySelector(
      `div[data-node-id="${docId}"].protyle-title`
    );
    if (!parentNode) {
      console.log("Parent node not found");
      return;
    }

    const targetNode = parentNode.querySelector("div.protyle-attr");
    if (!targetNode) {
      console.log("Target child div not found");
      return;
    }

    const newDiv = document.createElement("div");
    newDiv.className = "mux-attribute-panel";
    targetNode.after(newDiv);

    const app = createApp(App);
    const pinia = createPinia();

    app.provide("$plugin", this);
    app.provide("$EventBus", this.eventBus);
    app.provide("$docId", docId);

    app.use(pinia);
    app.mount(newDiv);
    this.panelRegistry.mount(docId, app, newDiv);
  }
}
