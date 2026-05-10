'use client'

import { PSRTEntry, PSRTSection } from '@/services/psrt/types'
import _ from 'lodash'
import Image from 'next/image'
import { CSSProperties, RefObject, useEffect, useRef } from 'react'
import ReactDOMServer from 'react-dom/server'

export default function ImagePsrt({
  pageData,
  hideSub,
  alt,
  editor,
  onClickEntry,
  selectedIndex,
  pageLink,
  parentZoom,
  getSize,
}: {
  pageData: PSRTSection
  alt: string
  hideSub?: boolean
  editor?: boolean
  onClickEntry?: (_entryIndex: number, _entry: PSRTEntry) => void
  selectedIndex?: number
  pageLink?: string
  parentZoom?: number
  // eslint-disable-next-line unused-imports/no-unused-vars
  getSize?: ({ w, h }: { w?: number; h?: number }) => void
}) {
  const imageRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    getSize?.({
      w: imageRef.current?.width,
      h: imageRef.current?.height,
    })
  }, [parentZoom, getSize])
  return (
    <div id="psrt-image-container" className="relative w-full">
      <div id="image-container" className="w-full">
        <Image
          ref={imageRef}
          src={pageLink || '/assets/page_not_image.png'} // Assuming the image src is in the first entry's text field
          alt={alt}
          width={2000}
          height={0} // Height can be set to auto
          style={{ objectFit: 'fill', width: '100%' }}
        />
      </div>
      {!hideSub && (
        <div
          id="entries-container"
          className="absolute w-full h-[100%] top-0 left-0"
        >
          {parentZoom &&
            editor &&
            pageData?.entries.map((entry: PSRTEntry, index: number) => {
              const {
                fontSize,
                border,
                borderWidth,
                borderColor,
                ...parsedStyles
              } = styleParser(entry, imageRef)
              const { style, ...coordinates } = entry

              return (
                <div
                  onClick={() => onClickEntry?.(index, entry)}
                  key={`${index}--${pageLink}--mask`}
                  className="entry"
                  style={{
                    position: 'absolute',
                    left: `${entry.x}%`,
                    top: `${entry.y}%`,
                    width: `${entry.width}%`,

                    ...parsedStyles,
                    textShadow: 'none',
                    backgroundColor: 'transparent',
                    WebkitTextStrokeWidth: 'none',
                    WebkitTextStrokeColor: '#000',
                    zIndex: 100,
                    ...(selectedIndex === index
                      ? {
                        cursor: 'default',
                        borderWidth: '1px',
                        borderColor: '#01fe2b',
                        borderStyle: 'solid',
                      }
                      : { cursor: 'pointer' }),
                  }}
                  data-cordinate={JSON.stringify(coordinates)}
                >
                  <p className="w-full" style={{ fontSize, color: '#0000' }}>
                    {entry.text}
                  </p>
                </div>
              )
            })}

          {
            parentZoom &&
            pageData?.entries?.map((entry: PSRTEntry, index: number) => {
                const { fontSize, ...parsedStyles } = styleParser(
                  entry,
                  imageRef
                )
                const { style, ...coordinates } = entry

                return (
                  <div
                    onClick={() => onClickEntry?.(index, entry)}
                    key={`${index}--${pageLink}`}
                    className="entry"
                    style={{
                      position: 'absolute',
                      left: `${entry.x}%`,
                      top: `${entry.y}%`,
                      width: `${entry.width}%`,
                      cursor: 'pointer',
                      ...parsedStyles,
                    }}
                    data-cordinate={JSON.stringify(coordinates)}
                  >
                    <p className="w-full" style={{ fontSize }}>
                      {entry.text}
                    </p>
                  </div>
                )
              })
          }
          {
            parentZoom &&
            pageData?.entries.map((entry: PSRTEntry, index: number) => {
              if (!entry.style?.WebkitTextStrokeWidth) return null

                const { fontSize, ...parsedStyles } = styleParser(
                  entry,
                  imageRef
                )
                const { style, ...coordinates } = entry

                return (
                  <div
                    onClick={() => onClickEntry?.(index, entry)}
                    key={`${index}--${pageLink}--mask`}
                    className="entry"
                    style={{
                      position: 'absolute',
                      left: `${entry.x}%`,
                      top: `${entry.y}%`,
                      width: `${entry.width}%`,
                      cursor: 'pointer',
                      ...parsedStyles,
                      textShadow: 'none',
                      backgroundColor: 'transparent',
                      WebkitTextStrokeWidth: 'none',
                      WebkitTextStrokeColor: '#000',
                    }}
                    data-cordinate={JSON.stringify(coordinates)}
                  >
                    <p className="w-full" style={{ fontSize }}>
                      {entry.text}
                    </p>
                  </div>
                )
              })
          }
        </div>
      )}
    </div>
  )
}

export const SpechBaloonSvg: React.FC<{
  w: number
  stroke: number
  h: number
  color: string
  borderColor: string
}> = ({ w, stroke, h, color, borderColor }) => {
  const strokeMax = Math.min(stroke, w * 0.4, h * 0.4)
  return (
    <svg
      width={w.toString()}
      height={h.toString()}
      viewBox={`0 0 ${w} ${h}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="blue"
    //style={{ backgroundColor: 'green' }}
    >
      <ellipse
        cx={w / 2}
        cy={h / 2}
        rx={w / 2 - strokeMax / 2}
        ry={h / 2 - strokeMax / 2}
        fill="none"
        stroke={borderColor}
        strokeWidth={strokeMax}
      />
      {stroke > 0 && (
        <polygon
          points={`${0},${h} ${w * 0.33 - Math.min(strokeMax * 4, w * 0.1)},${h - h * 0.4} ${Math.min(w * 0.62 + strokeMax * 4, w * 0.8)},${h - h * 0.4}`} // Adjust the points for the desired shape
          fill={borderColor}
        />
      )}
      <polygon
        points={`${0},${h} ${w * 0.8},${h - h * 0.5} ${w * 0.4},${h / 2}`} // Adjust the points for the desired shape
        fill={color}
      //   stroke="black"
      //   strokeWidth={stroke}
      />
      <ellipse
        cx={w / 2}
        cy={h / 2}
        rx={w / 2 - strokeMax / 2}
        ry={h / 2 - strokeMax / 2}
        fill={color}
      />
    </svg>
  )
}

const parsePercentToPx = (value: number, total: number) => {
  return `${total * (value / 100)}px`
}

export function svgToDataUrl(svg: React.ReactElement): string {
  const svgString = ReactDOMServer.renderToStaticMarkup(svg)
  const encodedSvg = encodeURIComponent(svgString)
  return `data:image/svg+xml,${encodedSvg}`
}
const balloons = {
  default: SpechBaloonSvg,
}

const styleParser = (
  entry: PSRTEntry,
  parentRef?: RefObject<HTMLImageElement>
): CSSProperties => {
  const { balloon = 'none', ...style } = entry.style as CSSProperties & {
    balloon: 'default'
  }
  const parent = parentRef?.current
  const width = parent?.width
  const height = parent?.height

  const newStyle = _.cloneDeep(style) || ({} as CSSProperties)

  const parseShadow = (shadow: keyof CSSProperties) => {
    if (!newStyle[shadow]) return
    _.set(
      newStyle,
      shadow,
      parseTextShadow(newStyle[shadow] as string, width, height)
    )
  }

  parseShadow('textShadow')
  parseShadow('boxShadow')
  parseShadow('WebkitBoxShadow')
  parseShadow('MozBoxShadow')

  if (width) {
    _.set(newStyle, 'fontSize', parsePercentToPx(entry.size, width))

    style?.lineHeight &&
      _.set(
        newStyle,
        'lineHeight',
        parsePercentToPx(
          parseFloat(style?.lineHeight?.toString() || '0'),
          width
        )
      )

    style?.borderWidth &&
      _.set(
        newStyle,
        'borderWidth',
        parsePercentToPx(
          parseFloat(style?.borderWidth?.toString() || '0'),
          width
        )
      )

    if (balloon !== 'none' && balloons[balloon]) {
      const MyBackgroundSvg = balloons[balloon] as typeof SpechBaloonSvg
      const svgDataUrl = svgToDataUrl(
        <MyBackgroundSvg
          stroke={parseFloat(style.borderWidth?.toString() || "0")}
          w={parseFloat(parsePercentToPx(entry.width, width))}
          h={parseFloat(parsePercentToPx((entry.style?.height as number) || entry.width, height as number))}
          color={style.backgroundColor as string}
          borderColor={style.borderColor as string}
        />
      )
      _.set(newStyle, 'backgroundSize', `cover`)
      _.set(newStyle, 'backgroundImage', `url(${svgDataUrl})`)
    }
  }
  if (entry.size) {
    style?.WebkitTextStrokeWidth &&
      _.set(
        newStyle,
        'WebkitTextStrokeWidth',
        `${entry.size * (parseFloat(style?.WebkitTextStrokeWidth?.toString() || '0') / 100)}px`
      )
  }

  return newStyle
}

const parseTextShadow = (
  textShadow: string,
  width?: number,
  height?: number
): string => {
  return textShadow
    .split(',')
    .map((shadow) => {
      const parts = shadow.trim().split(/\s+/)

      const shiftX =
        parts[0].endsWith('%') && width
          ? `${((parseFloat(parts[0]) / 100) * width).toFixed(3)}px`
          : parts[0]
      const shiftY =
        parts[1].endsWith('%') && height
          ? `${((parseFloat(parts[1]) / 100) * height).toFixed(3)}px`
          : parts[1]
      const blur =
        parts[2].endsWith('%') && width && height
          ? `${((parseFloat(parts[2]) / 100) * Math.max(width, height)).toFixed(3)}px`
          : parts[2]
      const color = parts[3]

      return `${shiftX} ${shiftY} ${blur} ${color}`
    })
    .join(', ')
}
