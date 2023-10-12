# Self TypeScript SDK

[![CI](https://github.com/joinself/self-typescript-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/joinself/self-typescript-sdk/actions/workflows/ci.yml)

The official Self SDK for TypeScript.

This SDK provides a toolset to interact with the Self network from your TypeScript code.

## Installation

```bash
$ npm install self-sdk
```

## Usage

### Register Application

Before the SDK can be used you must first register an application on the Self Developer Portal. Once registered, the portal will generate credentials for the application that the SDK will use to authenticate against the Self network.

Self provides two isolated networks:

[Developer Portal (production network)](https://developer.joinself.com) - Suitable for production services  
[Developer Portal (sandbox network)](https://developer.sandbox.joinself.com) - Suitable for testing and experimentation

Register your application using one of the links above ([further information](https://docs.joinself.com/quickstart/app-setup/)).

### Examples

#### Client Setup

```typescript
async function main() {
  const selfsdk = require("self-sdk");

  const client = await selfsdk.build(
    "<application-id>",
    "<application-secret-key>",
    "random-secret-string",
    "/data",
    { env: "sandbox" },  // optional (defaults to production)
  );

  await client.start()
}

main();
```

Additionally, you can import the transpiled modules from `dist/lib` in case you have a modular library:

```typescript
import authentication from "self-sdk/authentication"
```

#### Identity

The identity service provides functionality for looking up identities, devices and public keys.

Get an identity:

```typescript
let identity = await client.identity().get("<self-id>")
```

#### Facts

The fact service can be used to ask for specific attested facts from an identity.

Request a fact:

```typescript
let phoneNumber = await client.facts().request("<self-id>", [{ fact: "phone_number" }])
```

#### Authentication

The authentication service can be used to send an authentication challenge to a users device. The response the user sends will be signed by their identity and can be validated.

```typescript
let resp = await client.authentication().request("<self-id>")
```

## Documentation

- [Documentation](https://docs.joinself.com/)
- [Examples](_examples)

## Development

### NPM Scripts

 - `npm t`: Run test suite
 - `npm start`: Run `npm run build` in watch mode
 - `npm run test:watch`: Run test suite in [interactive watch mode](http://facebook.github.io/jest/docs/cli.html#watch)
 - `npm run test:prod`: Run linting and generate coverage
 - `npm run build`: Generate bundles and typings, create docs
 - `npm run lint`: Lints code
 - `npm run commit`: Commit using conventional commit style ([husky](https://github.com/typicode/husky) will tell you to use it if you haven't :wink:)
 - `npm run generate-sources` : Generates the valid sources based on a json file (tools/config/sources.json).

## Support

Looking for help? Reach out to us at [support@joinself.com](mailto:support@joinself.com)

## Contributing

See [Contributing](CONTRIBUTING.md).

## License

See [License](LICENSE).
