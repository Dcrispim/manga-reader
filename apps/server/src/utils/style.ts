import { RGBColor } from 'react-color'
export const parseTitle = (text: string) => {
  return text
    .trim()
    .split(' ')
    .map((word) => word[0].toUpperCase() + word.substr(1))
    .join(' ')
}

export const parseRGBAToHEXAlpha = (rgb: RGBColor): string => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  const { r, g, b, a = 1 } = rgb
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(Math.round(a * 255))}`
}
