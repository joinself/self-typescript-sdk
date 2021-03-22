// Copyright 2020 Self Group Ltd. All Rights Reserved.

import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import sourceMaps from 'rollup-plugin-sourcemaps'
import camelCase from 'lodash.camelcase'
import typescript from 'rollup-plugin-typescript2'
import json from 'rollup-plugin-json'
import ts from "@wessberg/rollup-plugin-ts"

const pkg = require('./package.json')

const libraryName = 'self-sdk'

export default {
  input: `src/${libraryName}.ts`,
  output: [
    { file: pkg.main, name: camelCase(libraryName), format: 'umd', sourcemap: true },
    { file: pkg.module, format: 'es', sourcemap: true },
  ],
  // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
  external: [],
  watch: {
    include: 'src/**',
  },
  plugins: [
    // Allow json resolution
    json(),

    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs({
        namedExports: {
            // left-hand side can be an absolute path, a path
            // relative to the current directory, or the name
            // of a module in node_modules
            'self-protos/acl_pb.js': [ 'AccessControlList' ],
            'self-protos/msgtype_pb.js': [ 'MsgType' ],
            'self-protos/aclcommand_pb.js': [ 'ACLCommand' ],
            'self-protos/message_pb.js': [ 'Message' ],
            'self-protos/auth_pb.js': [ 'Auth' ]
          }
    }),

    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve(),

    // Resolve source maps to the original source
    sourceMaps(),

    // https://github.com/wessberg/rollup-plugin-ts
    ts({
        tsconfig: resolvedConfig => ({...resolvedConfig, allowJs: false, checkJs: false})
    })
  ],
}
