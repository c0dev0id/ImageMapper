import { crc32, deflateSync } from 'node:zlib'

type Rgba = readonly [number, number, number, number]

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * A PNG filled with one RGBA colour, with lines of another along its top and left edge
 * when given: tiles side by side then show a grid, so screenshots show the map move.
 * Map tiles and images to add, without binary fixtures.
 */
export function solidPng(width: number, height: number, rgba: Rgba, line?: Rgba): Buffer {
  const row = Buffer.alloc(1 + width * 4)
  for (let x = 0; x < width; x++) row.set(line && x < 2 ? line : rgba, 1 + x * 4)
  const edge = Buffer.alloc(1 + width * 4)
  for (let x = 0; x < width; x++) edge.set(line ?? rgba, 1 + x * 4)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 6, 0, 0, 0], 8) // 8 bits per channel, RGBA, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, (_, y) => (y < 2 ? edge : row))))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
