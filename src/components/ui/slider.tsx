'use client'

import * as SliderPrimitive from '@radix-ui/react-slider'

export function Slider({ className, ...props }: SliderPrimitive.SliderProps) {
  return (
    <SliderPrimitive.Root
      className={`relative flex items-center select-none touch-none ${className}`}
      {...props}
    >
      <SliderPrimitive.Track className="relative w-full h-2 bg-gray-200 rounded-full">
        <SliderPrimitive.Range className="absolute h-full bg-blue-500 rounded-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block w-4 h-4 bg-blue-500 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" />
    </SliderPrimitive.Root>
  )
}
