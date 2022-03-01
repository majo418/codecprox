// import express, compression, cors, morgan
import dns from "dns"
import env from "./env/envParser"
import { RequestListener, Server as HttpServer } from "http"
import { Server as HttpsServer } from "https"
import { createCertWatcher, fixPath, loadCerts } from "./certs"
import { loadRawRules, parseRules, sortRules } from "./rule"
import { createResolvers, findResolver } from "./resolver"
import { createHttpServer, createHttpsServer, UpgradeListener } from "./server"
import { MemoryCache } from "./cache"
import { parseRequestUrl } from "./consts"

console.log("CProX| Init...")

if (!env.PRODUCTION) {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
}

dns.setServers(env.DNS_SERVER_ADDRESSES)

const certPaths = {
    cert: fixPath(env.CERT_PATH),
    key: fixPath(env.KEY_PATH),
    ca: fixPath(env.CA_PATH),
}

const cache = new MemoryCache()
cache.startCheckInterval(1000 * 20, async (p) => {
    await p
    env.VERBOSE && console.log("CProX| Cache: cleared!")
})

console.log("CProX| Load rules...")
const rules = sortRules(parseRules(loadRawRules()))
if (rules.length == 0) {
    console.error("No rules found")
    process.exit(0)
}
env.VERBOSE && console.log("CProX| Rules:\n", rules)
console.log("CProX| " + rules.length + " rules found!")
console.log("CProX| Create resolver...")
const resolvers = createResolvers(
    rules,
    cache,
    {
        cacheMillis: 1000 * 60 * 2,
        verbose: env.VERBOSE,
    }
)

console.log("CProX| Create vars...")
const requestListener: RequestListener = (req, res) => {
    try {
        res.setHeader("X-powered-by", "CProX")
        res.setHeader("Server", "CProX")
        if (!req.headers.host || !req.url) {
            res.writeHead(404)
            res.end()
            return
        }
        const data = parseRequestUrl(
            req.headers.host,
            req.url
        )
        const resolve = findResolver(
            data,
            resolvers,
            cache,
            1000 * 30,
            env.VERBOSE
        )
        if (!resolve) {
            res.writeHead(404)
            res.end()
            return
        }
        resolve?.http(data, req, res)
    } catch (err) {
        res.statusCode = 500
        res.end()
        console.error("Error on request!\npath:" + req.url + "\nhost:", req.headers.host, "\n", err)
    }
}

const upgradeListener: UpgradeListener = (req, socket, head) => {
    try {
        if (!req.headers.host || !req.url) {
            socket.destroy()
            return
        }
        const data = parseRequestUrl(
            req.headers.host,
            req.url
        )
        const resolve = findResolver(
            data,
            resolvers,
            cache,
            1000 * 30,
            env.VERBOSE
        )
        if (!resolve) {
            socket.destroy()
            return
        }
        resolve?.ws(data, req, socket, head)
    } catch (err: Error | any) {
        socket.destroy(err)
        console.error(err)
    }
}

let httpServer: HttpServer | undefined
let httpsServer: HttpsServer | undefined
let httpServerPromise: Promise<HttpServer> | undefined
let httpsServerPromise: Promise<HttpsServer> | undefined
let restartPromise: Promise<void> | undefined

const restart: () => Promise<void> = async () => {
    if (restartPromise) {
        restartPromise = restartPromise.then(() => start())
        return
    }
    const p = restartPromise = start()
    await p
    if (restartPromise == p) {
        restartPromise = undefined
    }
}

const start: () => Promise<void> = async () => {
    console.log("------------------------------------------------------")
    console.log("CProX| Starting...")
    httpServerPromise = createHttpServer(
        env.HTTP_PORT,
        env.BIND_ADDRESS,
        requestListener,
        upgradeListener,
        httpServer,
    )
    httpsServerPromise = createHttpsServer(
        env.HTTPS_PORT,
        env.BIND_ADDRESS,
        requestListener,
        upgradeListener,
        httpsServer,
        () => loadCerts(certPaths, env.IGNORE_EMPTY_CERT),
    )
    const [httpServer2, httpsServer2] = await Promise.all([
        httpServerPromise,
        httpsServerPromise
    ])
    httpServer = httpServer2
    httpsServer = httpsServer2
    console.log("CProX| Started!")
}

const watcher = createCertWatcher(certPaths, () => restart())
restart()
