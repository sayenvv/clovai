import { memo } from 'react'
import { icons, HelpCircle, type LucideProps } from 'lucide-react'

export interface IconProps extends LucideProps {
  /** Icon name in kebab-case as used in JSON config, e.g. "git-branch". */
  name: string
}

function kebabToPascal(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/** Resolves a lucide icon from its kebab-case JSON name at runtime,
 *  falling back to a help icon for unknown names. */
export const Icon = memo(function Icon({ name, ...props }: IconProps) {
  const LucideIcon = icons[kebabToPascal(name) as keyof typeof icons] ?? HelpCircle
  return <LucideIcon {...props} />
})
