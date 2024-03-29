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

### Write index

```js
import fs from 'fs'
import { Readable } from 'stream'
import { CarIndexer } from '@ipld/car/indexer'
import { IndexSortedWriter } from 'cardex'

const carStream = fs.createReadStream('my.car')
const indexer = await CarIndexer.fromIterable(carStream)

const { readable, writable } = new TransformStream()
const writer = IndexSortedWriter.createWriter({ writer: writable.getWriter() })

readable.pipeTo(Readable.toWeb(fs.createWriteStream('my.car.idx')))

for await (const { cid, offset } of indexer) {
  await writer.add(cid, offset)
}
await writer.close()
```

### Read index

```js
import fs from 'fs'
import { Readable } from 'stream'
import { IndexSortedReader } from 'cardex'

const carStream = fs.createReadStream('my.car.idx')
const reader = IndexSortedReader.createReader({ reader: Readable.toWeb(carStream).getReader() })

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(`${Buffer.from(value.digest).toString('hex')} @ ${value.offset}`)
}
```

### Multi-index index

The [multi-index index](https://github.com/web3-storage/specs/blob/c3288d4d500741ca6a72c71169c852ca498fad64/CARv2%20MultiIndex.md) is a custom index allowing multiple CAR indexes to be grouped together in a single index.

#### Write multi-index

```javascript
import { MultihashIndexSortedWriter } from 'cardex'
import { MultiIndexWriter } from 'cardex/multi-index'

const { readable, writable } = new TransformStream()
const writer = MultiIndexWriter.createWriter({ writer: writable.getWriter() })

readable.pipeTo(new WritableStream()) // destination

writer.add(carCID0, async ({ writer }) => {
  const index0 = MultihashIndexSortedWriter.createWriter({ writer })
  index0.add(cid, offset)
  await index0.close()
})

writer.add(carCID1, async ({ writer }) => {
  const index1 = MultihashIndexSortedWriter.createWriter({ writer })
  index1.add(cid, offset)
  await index1.close()
})

await writer.close()
```

#### Read multi-index

```javascript
import { MultihashIndexSortedReader, IndexSortedReader } from 'cardex'
import { MultiIndexReader } from 'cardex/multi-index'

const readable = new ReadableStream() // reader of a multi-index bytes
const reader = MultiIndexReader.createReader({ reader: readable.getReader() })

// add readers to the multi-index reader (to allow reading different index types)
reader.add(MultihashIndexSortedReader)
reader.add(IndexSortedReader)

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const { origin, multihash, digest, offset } = value // (origin is a CAR CID)
  console.log(`${origin} -> ${CID.createV1(raw.code, multihash)} @ ${offset}`)
}
```

### Universal reader

The universal reader is for when you don't know what type of CARv2 index you're reading. The universal reader automatically instantiates the correct reader for a given index based on the codec:

```js
import fs from 'fs'
import { Readable } from 'stream'
import { UniversalReader } from 'cardex/universal'

const carStream = fs.createReadStream('my.car.idx')
const reader = UniversalReader.createReader({ reader: Readable.toWeb(carStream).getReader() })

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(`${Buffer.from(value.digest).toString('hex')} @ ${value.offset}`)
  // Note: `value` might have `multihash` if reading from MultihashIndexSorted
  // and it might have `origin` if reading from `MultiIndex`.
}
```

## Contributing

Feel free to join in. All welcome. [Open an issue](https://github.com/alanshaw/cardex/issues)!

## License

Dual-licensed under [MIT + Apache 2.0](https://github.com/alanshaw/cardex/blob/main/LICENSE.md)
