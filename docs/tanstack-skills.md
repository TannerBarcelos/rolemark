# TanStack skills

The TanStack packages ship version-matched guidance, loaded on demand through
[TanStack Intent](https://github.com/TanStack/intent). Before writing or changing code that uses
one of these APIs, load the matching skill and follow it over your training data:

```bash
bunx @tanstack/intent@latest load <skill>
```

To see every skill with a full description, run `bunx @tanstack/intent@latest list`.

| Task                                                                                        | `<skill>`                                                       |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Start overview: Vite plugin, `getRouter`, root document shell, entry points                 | `@tanstack/start-client-core#start-core`                        |
| `createServerFn`, input validation, `useServerFn`, request/response utilities               | `@tanstack/start-client-core#start-core/server-functions`       |
| `createMiddleware`, request vs function middleware, `src/start.ts`                          | `@tanstack/start-client-core#start-core/middleware`             |
| API routes via `server.handlers` on `createFileRoute`                                       | `@tanstack/start-client-core#start-core/server-routes`          |
| Client vs server execution, `createServerOnlyFn`, `ClientOnly`, import protection, env vars | `@tanstack/start-client-core#start-core/execution-model`        |
| Session cookies, OAuth, CSRF, rate limiting                                                 | `@tanstack/start-client-core#start-core/auth-server-primitives` |
| Deployment, selective SSR, prerendering, caching headers                                    | `@tanstack/start-client-core#start-core/deployment`             |
| Server runtime: `getRequest`, cookies, `useSession`, request handling                       | `@tanstack/start-server-core#start-server-core`                 |
| React bindings: `StartClient`/`StartServer`, React-specific imports                         | `@tanstack/react-start#react-start`                             |
| React Server Components (`@tanstack/react-start/rsc`)                                       | `@tanstack/react-start#react-start/server-components`           |
| Migrating Next.js patterns                                                                  | `@tanstack/react-start#lifecycle/migrate-from-nextjs`           |
| Router core: route trees, `createFileRoute`, file naming, `Register`                        | `@tanstack/router-core#router-core`                             |
| `beforeLoad` guards, `redirect`, `_authenticated` layouts, RBAC                             | `@tanstack/router-core#router-core/auth-and-guards`             |
| Loaders, `loaderDeps`, caching, pending/error components, `router.invalidate`               | `@tanstack/router-core#router-core/data-loading`                |
| `Link`, `useNavigate`, preloading, navigation blocking                                      | `@tanstack/router-core#router-core/navigation`                  |
| `notFound`, `errorComponent`, route masking                                                 | `@tanstack/router-core#router-core/not-found-and-errors`        |
| Path params, splats, optional params                                                        | `@tanstack/router-core#router-core/path-params`                 |
| `validateSearch`, search middlewares, search param serialization                            | `@tanstack/router-core#router-core/search-params`               |
| SSR, streaming, `HeadContent`/`Scripts`, the `head` option                                  | `@tanstack/router-core#router-core/ssr`                         |
| Type inference, `from` narrowing, `getRouteApi`, `ValidateLinkOptions`                      | `@tanstack/router-core#router-core/type-safety`                 |
| Automatic code splitting, `.lazy.tsx`                                                       | `@tanstack/router-core#router-core/code-splitting`              |
| Router bundler plugin configuration                                                         | `@tanstack/router-plugin#router-plugin`                         |
| Virtual (programmatic) file routes                                                          | `@tanstack/virtual-file-routes#virtual-file-routes`             |

## Maintaining this table

`bunx @tanstack/intent@latest install --map` writes the full skill list into `AGENTS.md`. Don't
keep it there, because it costs about 10 KB of context in every session. After upgrading TanStack
packages, run `intent list` and update this table.
