import DefaultTheme from "vitepress/theme";
import SourceGotchaAnimation from "./components/SourceGotchaAnimation.vue";
import UpgradeCompareAnimation from "./components/UpgradeCompareAnimation.vue";
import WorkflowAnimation from "./components/WorkflowAnimation.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("WorkflowAnimation", WorkflowAnimation);
    app.component("UpgradeCompareAnimation", UpgradeCompareAnimation);
    app.component("SourceGotchaAnimation", SourceGotchaAnimation);
  },
};
