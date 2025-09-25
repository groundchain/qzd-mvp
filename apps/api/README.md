# QZD Platform API

The QZD Platform follows an API-first design. The complete contract for the
service lives in [`openapi/openapi.yaml`](./openapi/openapi.yaml) and can be used
to scaffold clients, servers, and documentation artifacts via
[OpenAPI Generator](https://openapi-generator.tech/).

## Generating artifacts

Install the generator CLI locally:

```bash
pnpm dlx @openapitools/openapi-generator-cli@latest version-manager set 7.5.0
```

Then generate the desired artifact, for example a NestJS server stub and a
TypeScript fetch-based client:

```bash
pnpm dlx @openapitools/openapi-generator-cli@latest generate \
  -i openapi/openapi.yaml \
  -g nestjs-server \
  -o generated/server

pnpm dlx @openapitools/openapi-generator-cli@latest generate \
  -i openapi/openapi.yaml \
  -g typescript-fetch \
  -o generated/client
```

Refer to the generator documentation for the list of available generators and
configuration options.
