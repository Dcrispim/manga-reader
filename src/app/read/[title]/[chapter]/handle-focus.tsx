'use client'

import { useEffect, useRef } from 'react'

export default function HandleFocus() {
    const divRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (divRef.current) {
            divRef.current.focus()
        }
    }, [])

    return <div ref={divRef} tabIndex={-1} />
}
