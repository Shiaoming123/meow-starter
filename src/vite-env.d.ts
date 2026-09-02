/// <reference types="vite/client" />

declare const __UPDATER_CONFIGURED__: boolean;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
