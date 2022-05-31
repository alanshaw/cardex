# cardex

Indexes for CARs.

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
