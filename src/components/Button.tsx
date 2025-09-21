import { ReactNode } from 'react'

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'purple' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export default function Button({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button'
}: ButtonProps) {
  const baseClasses = 'font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variantClasses = {
    primary: 'bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 focus:ring-green-500',
    secondary: 'bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 focus:ring-green-500',
    purple: 'bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 focus:ring-green-500',
    danger: 'bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 focus:ring-green-500',
    success: 'bg-green-50 hover:bg-green-100 text-green-800 border border-green-200 focus:ring-green-500'
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }

  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  )
}
