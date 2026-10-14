import React, { useState } from 'react'

export const CONTACT_EMAIL = 'designbyraido@gmail.com'
export const RESUME_PATH = '/Resume - Giancarlo Renzi.pdf'

// mailto: does nothing on machines without a mail app, so the address is also shown and copyable.
export function CopyEmail({ className = '' }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`flex items-center justify-between gap-2 text-[13px] md:text-[14px] ${className}`}>
      <span className="select-all truncate">{CONTACT_EMAIL}</span>
      <button type="button" onClick={copy} className="shrink-0 px-2 py-0.5 border border-infil font-mono text-[11px] tracking-widest uppercase hud-btn">
        {copied ? '[ COPIED ]' : '[ COPY ]'}
      </button>
    </div>
  )
}
