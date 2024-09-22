import IconImge from '../images/icon.svg'
import { CodeBracketIcon } from '@heroicons/react/20/solid'
import { ChatBubbleOvalLeftEllipsisIcon } from '@heroicons/react/20/solid'
import { BuildingStorefrontIcon } from '@heroicons/react/20/solid'

const codeUrl = "https://github.com/ShortArrow/razorshell"
const chatUrl = "https://discord.gg/razorshell/issues"
const storeUrl = "https://chromewebstore.google.com/detail/ahokbhndbjckeejighhkldiohmokpclb"

export function FooterApp() {
  return <>
    <footer className="footer footer-center bg-neutral text-neutral-content p-10">
      <aside>
        <img src={IconImge} alt="icon" className="w-16 h-16" />
        <p className="font-bold">
          Razorshell
        </p>
      </aside>
      <nav>
        <div className="grid grid-flow-col gap-4">
          <a href={codeUrl}>
            <CodeBracketIcon className="w-6 h-6" />
          </a>
          <a href={chatUrl}>
            <ChatBubbleOvalLeftEllipsisIcon className="w-6 h-6" />
          </a>
          <a href={storeUrl}>
            <BuildingStorefrontIcon className="w-6 h-6" />
          </a>
        </div>
      </nav>
    </footer>
  </>
}