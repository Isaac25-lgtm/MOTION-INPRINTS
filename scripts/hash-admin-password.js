#!/usr/bin/env node
/* Reads a password from a hidden prompt and writes only the scrypt encoding.
   Never accepts a password as a command-line argument. */

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { stdin as input, stdout as output } from 'node:process'
import { hashPassword } from '../server/admins.js'

function usage() {
  output.write('Usage: node scripts/hash-admin-password.js\n')
  output.write('Enter the password at the hidden prompt. The scrypt hash is printed and nothing else.\n')
}

function isThisScript() {
  if (!process.argv[1]) return false
  try {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
  } catch {
    return false
  }
}

function readHiddenPassword(prompt = 'Password: ') {
  return new Promise((resolve, reject) => {
    if (process.argv.length > 2) {
      reject(new Error('Do not pass the password as a command-line argument.'))
      return
    }
    output.write(prompt)
    const wasRaw = input.isRaw
    if (input.isTTY) input.setRawMode(true)
    input.resume()
    input.setEncoding('utf8')
    let buffer = ''
    const finish = (value) => {
      input.removeListener('data', onData)
      if (input.isTTY) input.setRawMode(Boolean(wasRaw))
      input.pause()
      output.write('\n')
      resolve(value)
    }
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          finish(buffer)
          return
        }
        if (char === '\u0003') {
          output.write('\n')
          process.exit(1)
        }
        if (char === '\u007f' || char === '\b') {
          buffer = buffer.slice(0, -1)
          continue
        }
        if (char < ' ') continue
        buffer += char
      }
    }
    input.on('data', onData)
  })
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage()
    process.exit(0)
  }
  if (process.argv.length > 2) {
    throw new Error('Do not pass the password as a command-line argument.')
  }
  const password = await readHiddenPassword()
  if (!password) throw new Error('A password is required.')
  output.write(`${await hashPassword(password)}\n`)
}

const isEntryPoint = isThisScript()
if (isEntryPoint) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage()
    process.exit(0)
  }
  if (process.argv.length > 2) {
    console.error('Do not pass the password as a command-line argument.')
    process.exit(1)
  }
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}

export { readHiddenPassword }
