import { MongoBinary } from 'mongodb-memory-server'

const path = await MongoBinary.getPath({ version: 'latest' })
console.log(`MongoDB binary ready at ${path}`)
