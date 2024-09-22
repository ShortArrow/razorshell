import { SunIcon } from "@heroicons/react/24/outline";
import { MoonIcon } from "@heroicons/react/24/outline";
export function ThemeApp() {
  return <>
    <label className="swap swap-rotate">
      {/* this hidden checkbox controls the state */}
      <input type="checkbox" className="theme-controller" value="light" />
      <MoonIcon className="swap-on h-10 w-10" />
      <SunIcon className="swap-off h-10 w-10" />
    </label>
  </>
}