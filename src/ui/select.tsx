import { SelectHTMLAttributes } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

/**
 * A `<select>` whose dropdown arrow is a real element rather than daisyUI's
 * pair of `linear-gradient` backgrounds.
 *
 * axe cannot resolve a background colour through a gradient, so every daisyUI
 * select came back as an undecided `color-contrast` result (`bgGradient`).
 * Suppressing the gradient (`select-arrowless`, defined in `css/options.css`)
 * and drawing the arrow as an absolutely positioned icon leaves the control
 * with a flat background axe can measure.
 *
 * Every `<select>` attribute is forwarded, so callers keep their own `id`,
 * `data-testid`, `aria-label`, sizing modifiers and change handler. `className`
 * is appended to the base classes rather than replacing them.
 */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const classes = ['select', 'select-bordered', 'select-arrowless', className]
    .filter((entry) => entry !== undefined && entry !== '')
    .join(' ');
  return (
    <span className='relative inline-flex items-center'>
      <select className={classes} {...rest}>
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden='true'
        className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4'
      />
    </span>
  );
}
