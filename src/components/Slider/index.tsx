'use client'
import { Slider as ShadSlider } from '@/components/ui/slider'
import React, { CSSProperties } from 'react'
export interface SliderProps {
  min?: number
  max?: number
  step?: number
  value?: number
  onChange?: (value: number) => void
  valueFormater?: (value: number) => string
  orientation?: 'horizontal' | 'vertical'
  className?: string
  hideText?: boolean
  nodes?: { [label: string]: number }
  inverted?: boolean
}

const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value = 50,
  valueFormater = (value: number) => value.toString(),
  onChange,
  orientation = 'horizontal',
  className,
  hideText,
  inverted,
  nodes = {},
}) => {
  const handleChange = (e: number[]) => {
    const newValue = parseFloat(e[0].toString())
    onChange?.(newValue)
  }

  const isHorizontal = orientation === 'horizontal'
  const trackStyle = isHorizontal
    ? ({
        backgroundSize: `${((value - min) / (max - min)) * 100}% 100%`,
      } as CSSProperties)
    : ({ marginTop: '50%' } as CSSProperties)

  const getNodePosition = (nodeValue: number) => {
    const position = ((nodeValue - min) / (max - min)) * 100
    return isHorizontal ? { left: `${position}%` } : { bottom: `${position}%` }
  }

  return (
    <div
      className={`relative flex h-full flex-col justify-between ${className}`}
    >
      {/* Slider input */}
      <ShadSlider
        disabled={max === min}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(e) => handleChange(e)}
        className={`w-full h-2 bg-gray-700 rounded-lg cursor-pointer`}
        style={{
          backgroundColor: max === 0 ? ' rgb(203 213 225)' : '',
          opacity: max === 0 ? 0.15 : 1,
          cursor: max === 0 ? 'default' : 'pointer',
        }}
        orientation={orientation}
        inverted={inverted}
        //style={trackStyle}
      />

      {/* Nodes */}
      <div className="absolute hidden flex w-full justify-evenly">
        {Object.entries(nodes).map(
          ([label, nodeValue], index) =>
            nodeValue < max &&
            nodeValue > min && (
              <div
                key={index}
                className={` flex items-center justify-center pointer-events-none w-2 h-2 bg-gray-400 rounded-full transform`}
                style={getNodePosition(nodeValue)}
                title={label}
              ></div>
            )
        )}
      </div>

      {/* Value display */}
      {!hideText && (
        <div
          className={`mt-2 w-full text-center ${isHorizontal ? '' : 'mt-4'}`}
        >
          {valueFormater(value)}
        </div>
      )}
    </div>
  )
}

export default Slider
