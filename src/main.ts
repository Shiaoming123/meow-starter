import { createApp } from "vue";
import App from "./App.vue";
import { mountModules } from "./modules/loader";
import "./assets/themes/global.css";

// 模块化装配：按 modules.config 的开关加载各能力模块。
// core 模块（设计系统 + 主题初始化）在 loader 里执行。
const app = createApp(App);

// Storage adapters are selected before App loads its state. A rejected
// optional/native module is still non-fatal: finally always renders the shell.
void mountModules(app)
  .catch((error: unknown) => {
    console.error("[modules] Module setup failed; continuing with the safe fallback.", error);
  })
  .finally(() => {
    app.mount("#app");
  });
