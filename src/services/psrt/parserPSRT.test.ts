import {
  parseCoordinates,
  parseEntryHeader,
  parseEntry,
  parseSection,
  parsePSRT,
  stringifyPsrt,
} from './parserPSRT'
import { PSRTFile } from './types'

describe('PSRT Parser Tests', () => {
  describe('parseCoordinates', () => {
    it('should parse coordinates correctly', () => {
      const coordinates = '55-2-2-11'
      const result = parseCoordinates(coordinates)
      expect(result).toEqual({ x: 55, y: 2, size: 2, width: 11 })
    })

    it('should handle edge cases with zero values', () => {
      const coordinates = '0-0-0-0'
      const result = parseCoordinates(coordinates)
      expect(result).toEqual({ x: 0, y: 0, size: 0, width: 0 })
    })
  })

  describe('parseEntryHeader', () => {
    it('should parse a line without page link correctly', () => {
      const line = '>>55-2-2-11 {"fontWeight":"bold"} 1'
      const result = parseEntryHeader(line)
      expect(result).toEqual({
        coordinates: { x: 55, y: 2, size: 2, width: 11 },
        style: { fontWeight: 'bold' },
        index: 1,
      })
    })

    it('should parse a line with page link correctly', () => {
      const line = '>>55-2-2-11 {"fontWeight":"bold"} 1'
      const result = parseEntryHeader(line)
      expect(result).toEqual({
        coordinates: { x: 55, y: 2, size: 2, width: 11 },
        style: { fontWeight: 'bold' },
        index: 1,
      })
    })

    it('should throw an error for invalid format', () => {
      const line = 'invalid format'
      expect(() => parseEntryHeader(line)).toThrowError(
        'Invalid line format: invalid format'
      )
    })
  })

  describe('parseEntry', () => {
    it('should parse an entry correctly', () => {
      const entryText = `${MOCK_PSRT_ENTRY_1}`
      const result = parseEntry(entryText)
      expect(result).toEqual({
        x: 55,
        y: 2,
        size: 2,
        width: 11,
        style: { fontWeight: 'bold' },
        index: 1,
        text: 'How dare you humans refuse punishment!',
      })
    })

    it('should handle empty subtitle text', () => {
      const entryText = `${MOCK_PSRT_ENTRY_EMPTY_TEXT}`
      const result = parseEntry(entryText)
      expect(result).toEqual({
        x: 55,
        y: 2,
        size: 2,
        width: 11,
        style: { fontWeight: 'bold' },
        index: 1,
        text: '',
      })
    })
  })

  describe('parseSection', () => {
    it('should parse a section correctly', () => {
      const sectionText = `${MOCK_PSRT_SECTION_PAGE1}`
      const result = parseSection(sectionText)

      expect(result).toEqual({
        title: 'page1',
        pageLink: 'http://www.myimg2.com',
        entries: [
          {
            x: 55,
            y: 2,
            size: 2,
            width: 11,
            style: { fontWeight: 'bold' },
            index: 1,

            text: 'How dare you humans refuse punishment!',
          },
          {
            x: 39,
            y: 5,
            size: 3,
            width: 10,
            style: { fontWeight: 'bold' },
            index: 2,
            text: 'Just beat them both',
          },
        ],
      })
    })

    it('should handle a section with no entries', () => {
      const sectionText = `${MOCK_PSRT_SECTION_EMPTY}`
      const result = parseSection(sectionText)
      expect(result).toEqual({
        title: 'page2',
        entries: [],
      })
    })
  })

  describe('parsePSRT', () => {
    it('should parse a PSRT file correctly', () => {
      const psrtText = `${MOCK_PSRT_TEXT}`
      const result = parsePSRT(psrtText)

      expect(result).toEqual({
        sections: [
          {
            title: 'page1',
            pageLink: 'http://www.myimg.com',
            entries: [
              {
                x: 55,
                y: 2,
                size: 2,
                width: 11,
                style: { fontWeight: 'bold' },
                index: 1,
                text: 'How dare you humans refuse punishment!',
              },
              {
                x: 39,
                y: 5,
                size: 3,
                width: 10,
                style: { fontWeight: 'bold' },
                index: 2,
                text: 'Just beat them both',
              },
            ],
          },
          {
            title: 'page2',
            entries: [
              {
                x: 10,
                y: 20,
                size: 30,
                width: 40,
                style: { color: 'red' },
                index: 3,
                text: 'Some other subtitle',
              },
            ],
          },
        ],
      })
    })

    it('should handle an empty PSRT file', () => {
      const psrtText = ''
      const result = parsePSRT(psrtText)
      expect(result).toEqual({ sections: [] })
    })
  })
})

describe('stringifyPsrt', () => {
  it('should correctly stringify a PSRTFile with a single section and single entry', () => {
    const psrtFile: PSRTFile = {
      sections: [
        {
          title: 'page1',
          pageLink: 'http://www.myimg.com',
          entries: [
            {
              x: 55,
              y: 2,
              size: 2,
              width: 11,
              style: { fontWeight: 'bold' },
              index: 1,
              text: 'How dare you humans refuse punishment!',
            },
          ],
        },
      ],
    }

    const expectedOutput = `
$START page1 http://www.myimg.com
>>55-2-2-11 {"fontWeight":"bold"} 1
How dare you humans refuse punishment!
$END page1
`.trim()

    expect(stringifyPsrt(psrtFile)).toBe(expectedOutput)
  })

  it('should correctly stringify a PSRTFile with multiple sections and entries', () => {
    const expectedOutput = `
$START page1 http://www.myimg.com
>>55-2-2-11 {"fontWeight":"bold"} 1
How dare you humans refuse punishment!

>>39-5-3-10 {"fontWeight":"bold"} 2
Just beat them both
$END page1
$START page2
>>10-20-30-40 {"color":"red"} 3
Some other subtitle
$END page2
`.trim()

    expect(stringifyPsrt(psrtFile)).toBe(expectedOutput)
  })

  it('should correctly stringify a PSRTFile with no styles or pageLink', () => {
    const psrtFile: PSRTFile = {
      sections: [
        {
          title: 'page1',
          entries: [
            {
              x: 10,
              y: 10,
              size: 5,
              width: 5,
              text: 'Simple text',
            },
          ],
        },
      ],
    }

    const expectedOutput = `
$START page1
>>10-10-5-5
Simple text
$END page1
`.trim()

    expect(stringifyPsrt(psrtFile)).toBe(expectedOutput)
  })
})

// Mock PSRT Texts
const MOCK_PSRT_ENTRY_1 = `
>>55-2-2-11 {"fontWeight":"bold"} 1
How dare you humans refuse punishment!
`
const MOCK_PSRT_ENTRY_EMPTY_TEXT = '>>55-2-2-11 {"fontWeight":"bold"} 1'
const MOCK_PSRT_SECTION_PAGE1 = `
$START page1    http://www.myimg2.com
>>55-2-2-11 {"fontWeight":"bold"} 1
How dare you humans refuse punishment!

>>39-5-3-10 {"fontWeight":"bold"} 2
Just beat them both

$END page1  
`
const MOCK_PSRT_SECTION_EMPTY = `$START page2\n$END page2`
const MOCK_PSRT_TEXT = `
$START page1  http://www.myimg.com
>>55-2-2-11 {"fontWeight":"bold"} 1
How dare you humans refuse punishment!

>>39-5-3-10 {"fontWeight":"bold"} 2
Just beat them both

$END page1

$START page2
>>10-20-30-40 {"color":"red"} 3
Some other subtitle

$END page2
`

const psrtFile: PSRTFile = {
  sections: [
    {
      title: 'page1',
      pageLink: 'http://www.myimg.com',
      entries: [
        {
          x: 55,
          y: 2,
          size: 2,
          width: 11,
          style: { fontWeight: 'bold' },
          index: 1,
          text: 'How dare you humans refuse punishment!',
        },
        {
          x: 39,
          y: 5,
          size: 3,
          width: 10,
          style: { fontWeight: 'bold' },
          index: 2,
          text: 'Just beat them both',
        },
      ],
    },
    {
      title: 'page2',
      entries: [
        {
          x: 10,
          y: 20,
          size: 30,
          width: 40,
          style: { color: 'red' },
          index: 3,
          text: 'Some other subtitle',
        },
      ],
    },
  ],
}
