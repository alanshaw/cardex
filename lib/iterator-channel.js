// copied from https://github.com/ipld/js-car/blob/master/lib/iterator-channel.js

/**
 * @template {any} T
 * @typedef {import('../types').IteratorChannel<T>} IteratorChannel
 */

function noop () {}

/**
 * @template {any} T
 * @returns {IteratorChannel<T>}
 */
export function create () {
  /** @type {T[]} */
  const chunkQueue = []
  /** @type {Promise<void> | null} */
  let drainer = null
  let drainerResolver = noop
  let ended = false
  /** @type {Promise<IteratorResult<T>> | null} */
  let outWait = null
  let outWaitResolver = noop

  const makeDrainer = () => {
    if (!drainer) {
      drainer = new Promise((resolve) => {
        drainerResolver = () => {
          drainer = null
          drainerResolver = noop
          // @ts-ignore Expected 1 argument, but got 0. 'new Promise()' needs a JSDoc hint to produce a 'resolve' that can be called without arguments.
          resolve()
        }
      })
    }
    return drainer
  }

  /**
  * @returns {IteratorChannel<T>}
  */
  const writer = {
    /**
    * @param {T} chunk
    * @returns {Promise<void>}
    */
    write (chunk) {
      chunkQueue.push(chunk)
      const drainer = makeDrainer()
      outWaitResolver()
      return drainer
    },

    async end () {
      ended = true
      const drainer = makeDrainer()
      outWaitResolver()
      await drainer
    }
  }

  /** @type {AsyncIterator<T>} */
  const iterator = {
    /** @returns {Promise<IteratorResult<T>>} */
    async next () {
      const chunk = chunkQueue.shift()
      if (chunk) {
        if (chunkQueue.length === 0) {
          drainerResolver()
        }
        return { done: false, value: chunk }
      }

      if (ended) {
        drainerResolver()
        return { done: true, value: undefined }
      }

      if (!outWait) {
        outWait = new Promise((resolve) => {
          outWaitResolver = () => {
            outWait = null
            outWaitResolver = noop
            return resolve(iterator.next())
          }
        })
      }

      return outWait
    }
  }

  return { writer, iterator }
}
