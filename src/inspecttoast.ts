/**
 * @file inspecttoast.ts
 * @brief A toast drawn with inline styles only, so it renders the same on any
 *        page regardless of the stylesheets that page ships.
 */

const containerId = "razorshell-inspect-toast";
const dismissDelay = 8000;

const containerStyle: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  top: "16px",
  right: "16px",
  zIndex: "2147483647",
  maxWidth: "360px",
  padding: "12px 16px",
  borderRadius: "8px",
  background: "rgba(24, 24, 27, 0.92)",
  color: "#ffffff",
  font: "13px/1.5 system-ui, sans-serif",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
  cursor: "pointer",
};

const titleStyle: Partial<CSSStyleDeclaration> = {
  margin: "0 0 6px",
  fontWeight: "600",
};

const lineStyle: Partial<CSSStyleDeclaration> = {
  margin: "2px 0 0",
  opacity: "0.9",
};

function applyStyle(element: HTMLElement, style: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, style);
}

function removeExisting(): void {
  document.getElementById(containerId)?.remove();
}

function buildLine(text: string): HTMLDivElement {
  const line = document.createElement("div");
  applyStyle(line, lineStyle);
  line.textContent = text;
  return line;
}

/**
 * @fn showToast
 * @brief Draw a titled message at the top right, replacing any toast already
 *        shown, and drop it after eight seconds or on click.
 * @param string title - The heading line
 * @param string[] lines - The body lines, one element per line
 * @return void
 */
export function showToast(title: string, lines: string[]): void {
  removeExisting();
  const container = document.createElement("div");
  container.id = containerId;
  applyStyle(container, containerStyle);

  const heading = document.createElement("div");
  applyStyle(heading, titleStyle);
  heading.textContent = title;
  container.appendChild(heading);

  for (const line of lines) container.appendChild(buildLine(line));

  const dismiss = () => container.remove();
  container.addEventListener("click", dismiss);
  setTimeout(dismiss, dismissDelay);
  document.body.appendChild(container);
}
