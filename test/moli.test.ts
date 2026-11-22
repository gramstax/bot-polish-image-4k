import {describe, expect, it} from "bun:test"
import {buildMoliArgs, cdpUrl, moliConfigFromApp} from "../src/lib/moli"
import {AppConfig} from "../src/lib/config"

describe(`buildMoliArgs`, () => {
  it(`passes --http-proxy explicitly (Moli ignores proxy env vars)`, () => {
    const args = buildMoliArgs({bin: `moli`, profileDir: `/tmp/p`, port: 9222, proxy: `http://proxy:3128`})
    expect(args).toEqual([`serve`, `--layout`, `-p`, `9222`, `-P`, `/tmp/p`, `--log-level`, `error`, `--http-proxy`, `http://proxy:3128`])
  })

  it(`omits the proxy flag when no proxy is configured`, () => {
    const args = buildMoliArgs({bin: `moli`, profileDir: `/tmp/p`, port: 9333, proxy: `  `})
    expect(args).toEqual([`serve`, `--layout`, `-p`, `9333`, `-P`, `/tmp/p`, `--log-level`, `error`])
    expect(args.join(` `)).not.toContain(`http-proxy`)
  })

  it(`derives the config from AppConfig`, () => {
    const cfg = AppConfig.load({MOLI_PORT: `9444`, MOLI_PROXY: `http://proxy:3128`, MOLI_PROFILE_DIR: `/tmp/mp`} as NodeJS.ProcessEnv)
    const moli = moliConfigFromApp(cfg)
    expect(moli.port).toBe(9444)
    expect(moli.proxy).toBe(`http://proxy:3128`)
    expect(moli.profileDir).toBe(`/tmp/mp`)
  })
})

describe(`cdpUrl`, () => {
  it(`points at the local CDP port`, () => {
    expect(cdpUrl(9222)).toBe(`http://127.0.0.1:9222`)
    expect(cdpUrl(9333)).toBe(`http://127.0.0.1:9333`)
  })
})
