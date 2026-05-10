export const BASE_FONT_URL = 'https://fonts.googleapis.com/css2?'

export const addFontOnURL = (
  fonturl: string,
  family: string,
  weigth?: number
) => {
  return `${fonturl}&family=${family.replaceAll(' ', '+')}${
    weigth ? `:wght@${weigth}` : ''
  }`
}

export const makeFontURL = (fonts: { family: string; weight?: number }[]) => {
  const url = fonts.reduce(
    (p, c) => addFontOnURL(p, c.family?.trim(), c.weight),
    BASE_FONT_URL
  )

  return url + '&display=swap'
}

export const getFontsFromUrl = (urlFont: string) => {
  const fonts = new URL(urlFont).searchParams.getAll('family').map((f) => {
    let font = f.split(':')
    return {
      family: font[0],
      weight: font[1] ? parseInt(font[1].replaceAll('wght@', '')) : undefined,
    }
  })

  return fonts
}

export const isFontUrl = (source: string) => source.search(urlFontRegex) >= 0

export const getFontURL = (source: string) =>
  isFontUrl(source) ? source.match(urlFontRegex)?.[0] || '' : source

export const getFonts = (
  urlFont: string[]
): { id: string; value: string }[] => {
  try {
    //@ts-ignore
    return urlFont?.reduce((p, c) => {
      try {
        if (isFontUrl(c)) {
          const fonts = new URL(getFontURL(c)).searchParams
            .getAll('family')
            .map((f) => f.split(':')[0])
          return [
            ...p,
            ...fonts.map((f) => ({ id: f.replaceAll(' ', '-'), name: f })),
          ]
        } else {
          return [
            ...p,
            { id: c.split('/')[0].replaceAll(' ', '-'), name: c.split('/')[0] },
          ]
        }
      } catch (e) {
        console.log(c)
      }
    }, [])
  } catch (e) {
    console.log(urlFont, e)
    return []
  }
}
const urlFontRegex = /(?<=url\(')(.*?)(?='\))/
