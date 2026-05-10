import { CSSProperties } from 'react'
import { PSRTFile, PSRTSection, PSRTEntry, PSRTEntryHeader } from './types'

/**
 * Parses the configuration part of a PSRT entry string.
 *
 * The PSRT entry string follows this format:
 *
 * "x-y-size-width"
 * Where:
 * - x: x-coordinate (0-100) based on the reference image size.
 * - y: y-coordinate (0-100) based on the reference image size.
 * - size: Size of the element (0-100) based on the reference image size.
 * - width: Width of the element (0-100) based on the reference image size.
 *
 * @param coordinates The string containing coordinates in the format `x-y-size-width`.
 * @returns An object containing `x`, `y`, `size`, and `width` as numbers.
 */
export function parseCoordinates(coordinates: string): {
  x: number
  y: number
  size: number
  width: number
} {
  const [x, y, size, width] = coordinates.split('-').map(parseFloat)
  return { x, y, size, width }
}

/**
 * Parses a PSRT entry line to extract coordinates, style, and index.
 *
 * The PSRT entry line follows this format:
 *
 * >>x-y-size-width { "CSSProperties" } index
 *
 * Where:
 * - x-y-size-width: A string containing the coordinates in the format `x-y-size-width`.
 * - { "CSSProperties" }: A JSON object string representing CSS properties to apply to the text.
 * - index: The index of the entry.
 *
 * Example input line:
 * >>55-2-2-11 {"fontWeight":"bold"} 1
 *
 * @param line The PSRT entry line to parse.
 * @returns An object containing:
 *   - coordinates: An object with `x`, `y`, `size`, and `width` as numbers.
 *   - style: An object representing CSS properties.
 *   - index: A number representing the index of the entry.
 * @throws Will throw an error if the line format is invalid.
 */

export function parseEntryHeader(line: string): PSRTEntryHeader {
  const match = line.match(/^>>(.+?) (\{.*?\}) (\d+)$/)

  if (!match) {
    throw new Error(`Invalid line format: ${line}`)
  }

  const [, coordinates, style, index] = match

  try {
    const data = {
      coordinates: parseCoordinates(coordinates),
      style: JSON.parse(style),
      index: parseInt(index, 10),
    } as PSRTEntryHeader
    return data
  } catch {
    throw new Error(
      'parseEntryHeader could not parse: ' +
        JSON.stringify({ coordinates, style, index })
    )
  }
}
/**
 * Parses a PSRT entry text to extract coordinates, style, index, and subtitle text.
 *
 * The PSRT entry text follows this format:
 *
 *>> \>>x-y-size-width { "CSSProperties" } index
 *
 *>> \<subtitle text>
 *
 * Where:
 * - x: x-coordinate (0-100) based on the reference image size.
 * - y: y-coordinate (0-100) based on the reference image size.
 * - size: Size of the element (0-100) based on the reference image size.
 * - width: Width of the element (0-100) based on the reference image size.
 * - { "CSSProperties" }: JSON object string representing CSS properties to apply to the text.
 * - index: The index of the entry.
 * - <subtitle text>: Subtitle text associated with the PSRT entry.
 *
 * Example input:
 *
 * >> \>>55-2-2-11 {"fontWeight":"bold"} 1
 *
 * >> How dare you humans refuse punishment!
 *
 * @param entryText The full text of the PSRT entry, including the configuration line and subtitle text.
 * @returns An object containing:
 *   - x: The x-coordinate as a number.
 *   - y: The y-coordinate as a number.
 *   - size: The size of the element as a number.
 *   - width: The width of the element as a number.
 *   - style: An object representing CSS properties.
 *   - index: A number representing the index of the entry.
 *   - text: The subtitle text as a string.
 */
export function parseEntry(entryText: string): PSRTEntry {
  const lines = entryText.trim().split('\n')
  const { coordinates, style, index } = parseEntryHeader(lines[0])
  const text = lines.slice(1).join(' ').trim()
  const entriesData = { ...coordinates, style, index, text } as PSRTEntry
  return entriesData
}

/**
 * Parses a PSRT section text to extract the section title and a list of entries.
 *
 * The PSRT section text follows this format:
 *
 * $START <section title>
 * >> \>>x-y-size-width { "CSSProperties" } index
 *
 * >>\<subtitle text>
 *
 * (Multiple entries may be separated by double newlines.)
 *
 * $END <section title>
 *
 * Where:
 * - $START <section title>: Denotes the beginning of a section with the given title.
 * - Entries: Each entry includes coordinates, style, index, and subtitle text.
 * - $END <section title>: Denotes the end of the section with the given title.
 *
 * Example input:
 *
 * >>$START page1
 *
 * >> \>>55-2-2-11 {"fontWeight":"bold"} 1
 *
 *>> How dare you humans refuse punishment!
 *
 * >> \>>39-5-3-10 {"fontWeight":"bold"} 2
 *
 *>> Just beat them both
 *
 * >>$END page1
 *
 * @param sectionText The full text of the PSRT section, including the section title, entries, and end marker.
 * @returns An object containing:
 *   - title: The title of the section as a string.
 *   - entries: An array of PSRTEntry objects representing the entries in the section.
 */
export function parseSection(sectionText: string): PSRTSection {
  const lines = sectionText.trim().split('\n')
  const titleLine = lines.shift()
  const pageHeader = titleLine ? titleLine.replace('$START ', '').trim() : ''
  const [title, pageLink] = pageHeader.split(/\s+/)

  const entriesText = lines
    .join('\n')
    .split('\n\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry && !entry.trim().startsWith('$END'))
  const entries = entriesText.map(parseEntry)
  const section = { title, entries } as PSRTSection

  if (pageLink) {
    section['pageLink'] = pageLink
  }
  return section
}

/**
 * Parses a PSRT file text to extract all sections, each with its title and entries.
 *
 * The PSRT file text follows this format:
 *
 * $START <section title>
 * >>x-y-size-width { "CSSProperties" } index
 * <subtitle text>
 *
 * (Multiple entries may be separated by double newlines.)
 *
 * $END <section title>
 *
 * Where:
 * - $START <section title>: Denotes the beginning of a section with the given title.
 * - Entries: Each entry includes coordinates, style, index, and subtitle text.
 * - $END <section title>: Denotes the end of the section with the given title.
 *
 * The function uses a regular expression to match and extract sections based on the `$START` and `$END` markers.
 *
 * Example input:
 * $START page1
 * >>55-2-2-11 {"fontWeight":"bold"} 1
 * Como vocês, humanos, ousam recusar a punição!
 *
 * >>39-5-3-10 {"fontWeight":"bold"} 2
 * Basta vencer as duas
 *
 * $END page1
 *
 * @param psrtText The full text of the PSRT file, including multiple sections.
 * @returns An object containing:
 *   - sections: An array of PSRTSection objects, each representing a section with its title and entries.
 */
export function parsePSRT(psrtText: string = ''): PSRTFile {
  // Regular expression to match sections between $START and $END
  const sectionRegex = /\$START\s+(\S+)[\s]*(\S+)?\n([\s\S]*?)\$END\s+\1/g
  const sections: PSRTSection[] = []

  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(psrtText.trim())) !== null) {
    const [, title, pageLink, sectionContent] = match

    sections.push(
      parseSection(
        `$START ${title}${pageLink ? ` ${pageLink}` : ''}\n${sectionContent}\n$END ${title}`
      )
    )
  }

  return { sections }
}

const stringifyStyle = (style: CSSProperties) => {
  return JSON.stringify(style)
}

const stringifyEntry = (entry: PSRTEntry) => {
  const { x, y, size, width, style, index, text } = entry
  const coordinates = `${x}-${y}-${size}-${width}`
  const styleString = style ? ` ${stringifyStyle(style)}` : ''
  const indexString = index !== undefined ? ` ${index}` : ''

  return `>>${coordinates}${styleString}${indexString}\n${text}\n`
}

export const stringifyPsrt = (data: PSRTFile): string => {
  return data.sections
    .map((section: PSRTSection) => {
      const sectionHeader = `$START ${section.title}${section.pageLink ? ` ${section.pageLink}` : ''}\n`
      const entriesString = section.entries
        .map((entry: PSRTEntry) => stringifyEntry(entry))
        .join('\n')
      const sectionFooter = `$END ${section.title}\n`
      return (sectionHeader + entriesString + sectionFooter).trim()
    })
    .join('\n')
    .trim()
}
