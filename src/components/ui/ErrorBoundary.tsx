'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="brawl-card p-8 text-center max-w-md">
            <p className="text-4xl mb-3">💥</p>
            <h2 className="font-['Lilita_One'] text-xl text-white mb-2">Oops!</h2>
            <p className="text-sm text-slate-400 mb-4">Error 💀</p>
            <button
              onClick={() => {
                this.setState({ hasError: false })
                window.location.reload()
              }}
              className="brawl-button px-6 py-2.5 text-sm"
            >
              🔄 Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
