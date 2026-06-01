import fs from 'fs'
import https from 'https'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cardMapPath = path.join(__dirname, 'server/cardImageMap.json')
const imageMap = JSON.parse(fs.readFileSync(cardMapPath, 'utf8'))

async function fetchCardDesc(id) {
  return new Promise((resolve) => {
    https.get(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${id}`, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data)
            if (json.data && json.data[0]) {
              resolve(json.data[0].desc)
            } else {
              resolve(null)
            }
          } catch (e) {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      })
    }).on('error', () => resolve(null))
  })
}

async function run() {
  for (let i = 1; i <= 4; i++) {
    const filePath = path.join(__dirname, `server/cards_${i}.js`)
    if (!fs.existsSync(filePath)) continue
    
    let content = fs.readFileSync(filePath, 'utf8')
    const regex = /\{([^}]+)\}/g
    
    let match;
    let newContent = content;
    const replacements = []
    
    while ((match = regex.exec(content)) !== null) {
      const block = match[0]
      const idMatch = block.match(/id:\s*'([^']+)'/)
      if (idMatch) {
        const id = idMatch[1]
        const url = imageMap[id]
        if (url) {
          const ygoproIdMatch = url.match(/\/(\d+)\.jpg/)
          if (ygoproIdMatch) {
            const ygoproId = ygoproIdMatch[1]
            console.log(`Fetching desc for ${id} (ygopro ${ygoproId})...`)
            const desc = await fetchCardDesc(ygoproId)
            if (desc) {
              const safeDesc = desc.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "")
              
              // Find everything from description: to the end of the block
              const descStart = block.indexOf('description:')
              if (descStart !== -1) {
                // Find the closing brace of the block, which is at the end
                // since block = "{ ... }"
                // Wait, block includes the closing brace `}`
                // Let's just replace from description: up to just before }
                // We know block ends with ' }' or '}'
                const beforeDesc = block.substring(0, descStart)
                const newBlock = beforeDesc + `description: '${safeDesc}' }`
                replacements.push({ old: block, new: newBlock })
              }
            }
            await new Promise(r => setTimeout(r, 50))
          }
        }
      }
    }
    
    for (const r of replacements) {
      newContent = newContent.replace(r.old, r.new)
    }
    
    fs.writeFileSync(filePath, newContent, 'utf8')
    console.log(`Updated cards_${i}.js`)
  }
}

run()
