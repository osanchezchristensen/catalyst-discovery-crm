import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary: 'border border-primary bg-card text-primary hover:bg-secondary',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
        ghost: 'text-foreground hover:bg-secondary',
        'ghost-destructive': 'text-destructive hover:bg-secondary'
      },
      size: {
        default: 'h-9 px-4 text-[15px]',
        sm: 'h-8 px-3 text-[13px]',
        icon: 'size-9'
      }
    },
    defaultVariants: { variant: 'primary', size: 'default' }
  }
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
