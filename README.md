# cardex

Indexes for CARs.

Implementations of CARv2 indexes in JavaScript. Status:

* [IndexSorted](https://ipld.io/specs/transport/car/carv2/#format-0x0400-indexsorted) ⏳ (in progress)
* [MultihashIndexSorted](https://ipld.io/specs/transport/car/carv2/#format-0x0401-multihashindexsorted) ❌ (not implemented)

## Usage

### Create index

```js
import fs from 'fs'
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
