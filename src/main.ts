import { createApp } from "vue";
import App from "./App.vue";
import { initTheme } from "./assets/themes/apply";
import "./assets/themes/global.css";

// 初始化主题（应用已保存主题 + 跟随系统深浅色）
initTheme();

createApp(App).mount("#app");
