import { Plugin, openTab } from "siyuan";
import type { IProtyle } from "siyuan";
import "@/index.scss";

// Vue
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "tdesign-vue-next/es/style/index.css";
import { DraggablePlugin } from "@braks/revue-draggable";
import SettingPage from "./views/SettingPage.vue";
import { PanelRegistry } from "@/services/panelRegistry";

const TAB_TYPE = "mux-plugin-siyuan-attributes-panel";

export default class PluginSample extends Plugin {
  private readonly panelRegistry = new PanelRegistry();

  private readonly handleLoadedProtyle = (event: { detail: { protyle: IProtyle } }) => {
    this.mountAttributePanel(event.detail.protyle);
  };

  async onload() {
    // 图标的制作参见帮助文档
    if (false) {
      this.addIcons(`<symbol id="iconFace" viewBox="0 0 32 32">
    <path d="M13.667 17.333c0 0.92-0.747 1.667-1.667 1.667s-1.667-0.747-1.667-1.667 0.747-1.667 1.667-1.667 1.667 0.747 1.667 1.667zM20 15.667c-0.92 0-1.667 0.747-1.667 1.667s0.747 1.667 1.667 1.667 1.667-0.747 1.667-1.667-0.747-1.667-1.667-1.667zM29.333 16c0 7.36-5.973 13.333-13.333 13.333s-13.333-5.973-13.333-13.333 5.973-13.333 13.333-13.333 13.333 5.973 13.333 13.333zM14.213 5.493c1.867 3.093 5.253 5.173 9.12 5.173 0.613 0 1.213-0.067 1.787-0.16-1.867-3.093-5.253-5.173-9.12-5.173-0.613 0-1.213 0.067-1.787 0.16zM5.893 12.627c2.28-1.293 4.040-3.4 4.88-5.92-2.28 1.293-4.040 3.4-4.88 5.92zM26.667 16c0-1.040-0.16-2.040-0.44-2.987-0.933 0.2-1.893 0.32-2.893 0.32-4.173 0-7.893-1.92-10.347-4.92-1.4 3.413-4.187 6.093-7.653 7.4 0.013 0.053 0 0.12 0 0.187 0 5.88 4.787 10.667 10.667 10.667s10.667-4.787 10.667-10.667z"></path>
    </symbol>
    <symbol id="iconSaving" viewBox="0 0 32 32">
    <path d="M20 13.333c0-0.733 0.6-1.333 1.333-1.333s1.333 0.6 1.333 1.333c0 0.733-0.6 1.333-1.333 1.333s-1.333-0.6-1.333-1.333zM10.667 12h6.667v-2.667h-6.667v2.667zM29.333 10v9.293l-3.76 1.253-2.24 7.453h-7.333v-2.667h-2.667v2.667h-7.333c0 0-3.333-11.28-3.333-15.333s3.28-7.333 7.333-7.333h6.667c1.213-1.613 3.147-2.667 5.333-2.667 1.107 0 2 0.893 2 2 0 0.28-0.053 0.533-0.16 0.773-0.187 0.453-0.347 0.973-0.427 1.533l3.027 3.027h2.893zM26.667 12.667h-1.333l-4.667-4.667c0-0.867 0.12-1.72 0.347-2.547-1.293 0.333-2.347 1.293-2.787 2.547h-8.227c-2.573 0-4.667 2.093-4.667 4.667 0 2.507 1.627 8.867 2.68 12.667h2.653v-2.667h8v2.667h2.68l2.067-6.867 3.253-1.093v-4.707z"></path>
    </symbol>`);

      this.addTopBar({
        icon: "iconFace",
        title: "属性面板设置",
        position: "right",
        callback: () => this.openSettingPage(),
      });

      // Init Tab
      let settingPageDiv = document.createElement("div");
      settingPageDiv.style.height = "100%";

      const setting = createApp(SettingPage);
      setting.provide("$plugin", this);

      const pinia = createPinia();
      setting.use(pinia);

      setting.mount(settingPageDiv);

      this.addTab({
        type: TAB_TYPE,
        init() {
          this.element.appendChild(settingPageDiv);
        },
      });
    }
  }

  onLayoutReady() {
    this.eventBus.on("loaded-protyle-static", this.handleLoadedProtyle);
  }

  async onunload() {
    this.eventBus.off("loaded-protyle-static", this.handleLoadedProtyle);
    this.panelRegistry.unmountAll();
  }

//   openSetting() {
//     console.log("openSetting");
//     this.openSettingPage();
//   }

  private openSettingPage() {
    openTab({
      app: this.app,
      custom: {
        icon: "iconFace",
        title: "属性面板",
        data: {
          text: "打开设置页面",
        },
        id: this.name + TAB_TYPE,
      },
      keepCursor: false,
      removeCurrentTab: true,
    });
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
    app.use(DraggablePlugin);
    app.mount(newDiv);
    this.panelRegistry.mount(docId, app, newDiv);
  }
}
