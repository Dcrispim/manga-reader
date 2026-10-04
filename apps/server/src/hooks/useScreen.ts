'use client'
import { useEffect, useState } from 'react'

export function useScreen() {
  const [isMobile, setIsMobile] = useState(false)
  const [isHuge, setIsHuge] = useState(false)
  const [width, setWidth] = useState(1920)
  const [height, setheight] = useState(1080)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window?.innerWidth <= 768)
      setIsHuge(window.innerWidth >= 2700)
      setWidth(window?.innerWidth)
      setheight(window?.innerHeight)
    }
    handleResize() // Check on initial load
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    isMobile,
    width,
    height,
    isHuge,
    setIsHuge,
  }
}
