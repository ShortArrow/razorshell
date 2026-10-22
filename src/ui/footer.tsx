import IconImge from '../images/icon.svg'
import { CodeBracketIcon } from '@heroicons/react/20/solid'
import { BuildingStorefrontIcon } from '@heroicons/react/20/solid'
import { feedbackLinks } from '../feedback'

const codeUrl = "https://github.com/ShortArrow/razorshell"
const storeUrl = "https://chromewebstore.google.com/detail/razorshell/ahokbhndbjckeejighhkldiohmokpclb"

export function FooterApp() {
  const links = feedbackLinks(chrome.runtime.getManifest().version);
  return <>
    <footer className="footer footer-center grid-flow-row bg-neutral text-neutral-content p-10">
      <aside>
        <img src={IconImge} alt="" className="w-16 h-16" />
        <p className="font-bold">
          Razorshell
        </p>
      </aside>
      <nav aria-label="feedback" className="grid grid-flow-col gap-6" data-testid="feedback-links">
        {links.map((link) => (
          <a key={link.label} className="link text-neutral-content" href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </nav>
      <nav aria-label="project">
        <div className="grid grid-flow-col gap-4">
          <a className="text-neutral-content" href={codeUrl} aria-label="source code" title="source code">
            <CodeBracketIcon className="w-6 h-6" />
          </a>
          <a className="text-neutral-content" href={storeUrl} aria-label="Chrome Web Store" title="Chrome Web Store">
            <BuildingStorefrontIcon className="w-6 h-6" />
          </a>
        </div>
      </nav>
    </footer>
  </>
}
