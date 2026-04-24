import type { ReactElement, ReactNode } from 'react'

interface PageIntroProps {
  title: string
  children: ReactNode
}

export default function PageIntro({ title, children }: PageIntroProps): ReactElement {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{title}</h1>
      <p className="text-neutral-500 text-sm mt-2 max-w-3xl leading-relaxed">{children}</p>
    </header>
  )
}
