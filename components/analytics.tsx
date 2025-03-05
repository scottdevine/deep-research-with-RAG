'use client'

import Script from 'next/script'

const GOOGLE_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_MEASUREMENT_ID || ''

export function Analytics() {
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_MEASUREMENT_ID}`}
      strategy='afterInteractive'
      onLoad={() => {
        // @ts-expect-error
        window.dataLayer = window.dataLayer || []
        function gtag() {
          // @ts-expect-error
          dataLayer.push(arguments)
        }
        // @ts-expect-error
        gtag('js', new Date())
        // @ts-expect-error
        gtag('config', GOOGLE_MEASUREMENT_ID)
      }}
    />
  )
}
