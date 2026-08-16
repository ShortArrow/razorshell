import { useEffect, useState } from "react";
import { SunIcon } from "@heroicons/react/24/outline";
import { MoonIcon } from "@heroicons/react/24/outline";

const themeKey = "theme";

function applyTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
}

function browserDefaultTheme(): string {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeApp() {
  const [theme, setTheme] = useState<string>(browserDefaultTheme);
  const [saveError, setSaveError] = useState<string>("");

  useEffect(() => {
    chrome.storage.sync.get({ [themeKey]: browserDefaultTheme() }).then((data) => {
      const stored = data[themeKey] as string;
      setTheme(stored);
      applyTheme(stored);
    });
  }, []);

  const toggle = (checked: boolean) => {
    const previous = theme;
    const next = checked ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    chrome.storage.sync.set({ [themeKey]: next })
      .then(() => setSaveError(""))
      .catch((failure: unknown) => {
        setSaveError(failure instanceof Error ? failure.message : String(failure));
        // The page already wears `next`. Storage refused it, so the document
        // and the toggle go back to the theme storage actually holds.
        setTheme(previous);
        applyTheme(previous);
      });
  };

  return <>
    <div className="flex items-center gap-2">
      <label className="swap swap-rotate">
        <input type="checkbox"
          data-testid="theme-toggle"
          aria-label="Toggle light and dark theme"
          checked={theme === "light"}
          onChange={(e) => toggle(e.target.checked)}
        />
        <MoonIcon className="swap-on h-10 w-10" />
        <SunIcon className="swap-off h-10 w-10" />
      </label>
      <div className="min-h-6" data-testid="theme-save-error">
        {saveError === "" ? null : <span className="text-error">{saveError}</span>}
      </div>
    </div>
  </>;
}
