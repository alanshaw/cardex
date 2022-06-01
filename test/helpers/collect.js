export const collect = async it => {
  const chunks = []
  for await (const chunk of it) {
    chunks.push(chunk)
  }
  return chunks
}
