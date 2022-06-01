# cardex

[![Build](https://github.com/alanshaw/cardex/actions/workflows/build.yml/badge.svg)](https://github.com/alanshaw/cardex/actions/workflows/build.yml)

Indexes for CARs.

Implementations of CARv2 indexes in JavaScript. Status:

* [IndexSorted](https://ipld.io/specs/transport/car/carv2/#format-0x0400-indexsorted) ⏳ (in progress)
* [MultihashIndexSorted](https://ipld.io/specs/transport/car/carv2/#format-0x0401-multihashindexsorted) ⏳ (in progress)

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
* `class IndexSortedWriter`
* `INDEX_SORTED_CODEC: number`
* `class MultihashIndexSortedReader`
* `class MultihashIndexSortedWriter`
* `MULTIHASH_INDEX_SORTED_CODEC: number`

## Releasing

You can publish by either running `npm publish` in the `dist` directory or using `npx ipjs publish`.

## Contributing

Feel free to join in. All welcome. [Open an issue](https://github.com/alanshaw/cardex/issues)!

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/alanshaw/cardex/blob/main/LICENSE.md)
