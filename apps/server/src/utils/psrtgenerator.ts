export const generatePSRTText = (pages: number, entriesPerPage: number) => {
  const styles = [
    '{"fontWeight":"bold"}',
    '{"color":"red"}',
    '{"fontStyle":"italic"}',
    '{"textDecoration":"underline"}',
  ]

  const generateRandomCoordinates = () => {
    const x = Math.floor(Math.random() * 80)
    const y = Math.floor(Math.random() * 80)
    const w = Math.floor(Math.random() * 5) + 1
    const h = Math.floor(Math.random() * 15) + 5
    return `${x}-${y}-${w}-${h}`
  }

  let psrtText = ''

  for (let i = 1; i <= pages; i++) {
    const link = `/assets/mangas/ajin/1/${i.toString().padStart(2, '0')}.png`
    psrtText += `$START page${i} ${link}\n`

    for (let j = 1; j <= entriesPerPage; j++) {
      const coordinates = generateRandomCoordinates()
      const style = JSON.stringify({
        backgroundColor: 'white',
        color: 'black',
        ...JSON.parse(styles[Math.floor(Math.random() * styles.length)]),
      })
      const index = j

      const text = `Sample text for page ${i}, entry ${j}.`

      psrtText += `>>${coordinates} ${style} ${index}\n`
      psrtText += `${text}\n\n`
    }

    psrtText += `$END page${i}\n\n`
  }

  return psrtText
}

const MOCK_PSRT_TEXT = generatePSRTText(50, 4)
