import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type ButtonVariant = 'primary' | 'secondary' | 'light' | 'ghost'

interface SharedProps {
  children: ReactNode
  className?: string
  variant?: ButtonVariant
  icon?: ReactNode
}

interface LinkButtonProps extends SharedProps {
  to: string
  onClick?: never
  type?: never
}

interface NativeButtonProps extends SharedProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps> {
  to?: never
}

type AppButtonProps = LinkButtonProps | NativeButtonProps

export function AppButton({ children, className = '', variant = 'primary', icon, ...props }: AppButtonProps) {
  const classes = `app-button app-button--${variant} ${className}`.trim()
  const content = <><span>{children}</span>{icon && <span className="app-button__icon">{icon}</span>}</>

  if ('to' in props && props.to) {
    return <Link className={classes} to={props.to}>{content}</Link>
  }

  return <button className={classes} {...props}>{content}</button>
}
