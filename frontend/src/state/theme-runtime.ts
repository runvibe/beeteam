import { createThemeController } from "./theme";
export const themeController = createThemeController(window);
if (import.meta.hot) import.meta.hot.dispose(() => themeController.dispose());
