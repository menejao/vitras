import { useEffect, useState } from "react";
import { readLS, writeLS } from "../utils/storage";

const THEME_KEY = "vitras_theme";

function detectSystemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = readLS(THEME_KEY, null);
    const t = saved || detectSystemTheme();
    document.documentElement.setAttribute("data-theme", t);
    return t;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    writeLS(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
