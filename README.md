# cardex

[![Build](https://github.com/alanshaw/cardex/actions/workflows/build.yml/badge.svg)](https://github.com/alanshaw/cardex/actions/workflows/build.yml)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/cardex)](https://bundlephobia.com/package/cardex)

Indexes for CARs.

Implementations of CARv2 indexes in JavaScript. Status:

* [IndexSorted](https://ipld.io/specs/transport/car/carv2/#format-0x0400-indexsorted) ✅ (complete & compatible)
* [MultihashIndexSorted](https://ipld.io/specs/transport/car/carv2/#format-0x0401-multihashindexsorted) ✅ (complete & compatible)

## Install

```
npm install cardex
```

## Usage

### Create index

```js
import fs from 'fs'
import { Readable } from 'stream'
import { CarIndexer } from '@ipld/car/indexer'
import { IndexSortedWriter } from 'cardex'

const carStream = fs.createReadStream('my.car')
const indexer = await CarIndexer.fromIterable(carStream)
const { writer, out } = IndexSortedWriter.create()

;(async () => {
  for await (const blockIndexData of indexer) {
    await writer.put(blockIndexData)
  }
  await writer.close()
})()

Readable.from(out).pipe(fs.createWriteStream('my.car.idx'))
```

### Read index

```js
import fs from 'fs'
import { IndexSortedReader } from 'cardex'

const carStream = fs.createReadStream('my.car.idx')
const reader = IndexSortedReader.fromIterable(carStream)

for await (const { digest, offset } of reader.entries()) {
  console.log(`${Buffer.from(digest).toString('hex')} @ ${offset}`)
}
```

## API

* `class IndexSortedReader`
    * `static fromIterable (iterable: AsyncIterable<Uint8Array>): IndexSortedReader`
    * `static fromBytes (bytes: Uint8Array): IndexSortedReader`
    * `entries (): AsyncIterable<{ digest: Uint8Array offset: number }>`
* `class IndexSortedWriter`
    * `static create (): IndexSortedWriter`
    * `put (blockIndexData: { cid: CID, offset: number }): Promise<void>`
    * `close (): Promise<void>`
* `class MultihashIndexSortedReader`
    * `static fromIterable(iterable: AsyncIterable<Uint8Array>): MultihashIndexSortedReader`
    * `static fromBytes(bytes: Uint8Array): MultihashIndexSortedReader`
    * `entries(): AsyncIterable<{ multihash: MultihashDigest, digest: Uint8Array offset: number }>`
* `class MultihashIndexSortedWriter`
    * `static create (): MultihashIndexSortedWriter`
    * `put (blockIndexData: { cid: CID, offset: number }): Promise<void>`
    * `close (): Promise<void>`
* `INDEX_SORTED_CODEC: number`
* `MULTIHASH_INDEX_SORTED_CODEC: number`

## Releasing

You can publish by either running `npm publish` in the `dist` directory or using `npx ipjs publish`.

## Contributing

Feel free to join in. All welcome. [Open an issue](https://github.com/alanshaw/cardex/issues)!

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/alanshaw/cardex/blob/main/LICENSE.md)
