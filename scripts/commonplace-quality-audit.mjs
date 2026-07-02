import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const CHECKLIST_FILE = "scripts/commonplace-quality-checklist.json"
const DEFAULT_REPORT_FILE = ".harness/reports/commonplace-quality-audit.json"
const SEVERITY_RANK = { pass: 0, pending: 1, warn: 2, fail: 3 }

const args = parseArgs(process.argv.slice(2))
const checklist = readJson(path.join(ROOT, CHECKLIST_FILE))
const thresholds = checklist.thresholds
const allFindings = []

const tokens = readTokens(checklist.tokens.files)
const staticFiles = collectStaticFiles(checklist.staticSources)
const dataVizFiles = collectExistingFiles(checklist.dataVizSources.files)

if (args.scope === "contrast" || args.scope === "all") {
  allFindings.push(...auditTokenContrast(tokens, checklist.tokens, thresholds))
}

if (args.scope === "all") {
  allFindings.push(...auditRawColors(staticFiles, checklist.tokens.definitionFiles))
  allFindings.push(...auditTypography(staticFiles, thresholds))
  allFindings.push(...auditMotion(staticFiles, thresholds))
  allFindings.push(...auditFocusContract(staticFiles))
  allFindings.push(...auditDataVizStatics(dataVizFiles))
  allFindings.push(...await auditRenderSeam(checklist.routes, args.baseUrl, thresholds))
}

const report = {
  audit: checklist.name,
  generatedAt: new Date().toISOString(),
  scope: args.scope,
  baseUrl: args.baseUrl ?? null,
  summary: summarize(allFindings),
  findings: allFindings.sort(compareFindings),
}

printReport(report, args.maxFindings)

if (args.output) {
  writeReport(args.output === true ? DEFAULT_REPORT_FILE : args.output, report)
}

if (report.summary.fail > 0) process.exit(1)

function parseArgs(argv) {
  const parsed = {
    baseUrl: null,
    maxFindings: 80,
    output: null,
    scope: "all",
  }

  for (const arg of argv) {
    if (arg === "--json" || arg === "--output") {
      parsed.output = true
      continue
    }
    if (arg.startsWith("--output=")) {
      parsed.output = arg.slice("--output=".length)
      continue
    }
    if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = trimSlash(arg.slice("--base-url=".length))
      continue
    }
    if (arg.startsWith("--max-findings=")) {
      parsed.maxFindings = Number(arg.slice("--max-findings=".length)) || parsed.maxFindings
      continue
    }
    if (arg.startsWith("--scope=")) {
      const scope = arg.slice("--scope=".length)
      if (scope !== "all" && scope !== "contrast") {
        throw new Error(`Unsupported scope "${scope}". Use all or contrast.`)
      }
      parsed.scope = scope
    }
  }

  return parsed
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"))
}

function readTokens(files) {
  const map = new Map()
  const tokenPattern = /^\s*(--[\w-]+):\s*([^;]+);/gm

  for (const file of files) {
    const absolutePath = path.join(ROOT, file)
    if (!existsSync(absolutePath)) continue
    const contents = readFileSync(absolutePath, "utf8")
    let match
    while ((match = tokenPattern.exec(contents)) !== null) {
      map.set(match[1], {
        file,
        raw: match[2].trim(),
      })
    }
  }

  return map
}

function collectStaticFiles(sourceConfig) {
  const fromDirs = sourceConfig.includeDirs.flatMap((dir) => walkFiles(path.join(ROOT, dir)))
  const fromFiles = collectExistingFiles(sourceConfig.includeFiles)
  const ignored = new Set(sourceConfig.ignoreFiles ?? [])
  return uniqueFiles([...fromDirs, ...fromFiles]).filter((file) => !ignored.has(relative(file)))
}

function collectExistingFiles(files) {
  return files
    .map((file) => path.join(ROOT, file))
    .filter((file) => existsSync(file) && statSync(file).isFile())
}

function walkFiles(dir) {
  if (!existsSync(dir)) return []
  const results = []
  for (const entry of readdirSync(dir)) {
    const absolutePath = path.join(dir, entry)
    const stat = statSync(absolutePath)
    if (stat.isDirectory()) {
      results.push(...walkFiles(absolutePath))
      continue
    }
    if (/\.(css|tsx|ts|jsx|js|mjs)$/.test(entry)) results.push(absolutePath)
  }
  return results
}

function auditTokenContrast(tokenMap, tokenConfig, limits) {
  const findings = []
  const baseBg = resolveColor("var(--cp-bg)", tokenMap)
  const surfaceMap = new Map([
    ...tokenConfig.surfaceTokens.map((token) => [token, { name: token, raw: `var(${token})` }]),
    ...tokenConfig.additionalSurfaces.map((surface) => [surface.name, surface]),
  ])
  const pairs = tokenConfig.contrastPairs ?? [
    {
      backgrounds: tokenConfig.surfaceTokens,
      foregrounds: tokenConfig.textTokens,
      name: "all",
    },
  ]

  for (const pair of pairs) {
    const pairBase = pair.base ? resolveColor(`var(${pair.base})`, tokenMap) : baseBg
    for (const textToken of pair.foregrounds) {
      const foreground = resolveColor(`var(${textToken})`, tokenMap)
      if (!foreground) {
        findings.push(finding("warn", "tokens", textToken, "Token does not resolve to a supported color."))
        continue
      }

      for (const surfaceName of pair.backgrounds) {
        const surface = surfaceMap.get(surfaceName) ?? { name: surfaceName, raw: `var(${surfaceName})` }
        const background = resolveColor(surface.raw ?? surface.value, tokenMap)
        if (!background) {
          findings.push(finding("warn", "tokens", `${textToken} on ${surface.name}`, "Surface does not resolve to a supported color."))
          continue
        }

        const bg = background.alpha < 1 && pairBase ? composite(background, pairBase) : background
        const fg = foreground.alpha < 1 ? composite(foreground, bg) : foreground
        const ratio = contrastRatio(fg.rgb, bg.rgb)
        const level = ratio >= limits.contrastNormal ? "pass" : "fail"
        findings.push(finding(level, "contrast", `${textToken} on ${surface.name}`, `${ratio.toFixed(2)}:1`, {
          foreground: rgbaString(fg),
          group: pair.name,
          ratio,
          surface: rgbaString(bg),
        }))
      }
    }
  }

  return findings
}

function auditRawColors(files, definitionFiles) {
  const allowed = new Set(definitionFiles)
  const findings = []
  const colorPattern = /(?:#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\))/g

  for (const file of files) {
    const rel = relative(file)
    const lines = readFileSync(file, "utf8").split("\n")
    lines.forEach((line, index) => {
      if (allowed.has(rel)) return
      if (line.includes("data:image") || line.includes("sourceMappingURL")) return
      const matches = line.match(colorPattern) ?? []
      for (const match of matches) {
        findings.push(finding("warn", "token-lint", `${rel}:${index + 1}`, `Raw color ${match} outside token definition files.`, {
          source: line.trim().slice(0, 180),
        }))
      }
    })
  }

  return findings
}

function auditTypography(files, limits) {
  const findings = []

  for (const file of files) {
    const rel = relative(file)
    const lines = readFileSync(file, "utf8").split("\n")

    lines.forEach((line, index) => {
      for (const size of fontSizesInLine(line)) {
        if (size < limits.minAbsoluteFontPx) {
          findings.push(finding("fail", "typography", `${rel}:${index + 1}`, `Font size ${size}px is below ${limits.minAbsoluteFontPx}px absolute floor.`, {
            source: line.trim().slice(0, 180),
          }))
        } else if (size < limits.minReadableFontPx) {
          findings.push(finding("warn", "typography", `${rel}:${index + 1}`, `Font size ${size}px is below ${limits.minReadableFontPx}px readable text target.`, {
            source: line.trim().slice(0, 180),
          }))
        }
      }

      for (const lineHeight of lineHeightsInLine(line)) {
        if (lineHeight < limits.minAbsoluteLineHeightRatio) {
          findings.push(finding("fail", "typography", `${rel}:${index + 1}`, `Line-height ${lineHeight} is below ${limits.minAbsoluteLineHeightRatio}.`, {
            source: line.trim().slice(0, 180),
          }))
        } else if (lineHeight < limits.minLineHeightRatio) {
          findings.push(finding("warn", "typography", `${rel}:${index + 1}`, `Line-height ${lineHeight} is below ${limits.minLineHeightRatio}.`, {
            source: line.trim().slice(0, 180),
          }))
        }
      }
    })
  }

  return findings
}

function fontSizesInLine(line) {
  const sizes = []
  const patterns = [
    /font-size\s*:\s*([0-9]*\.?[0-9]+)px/gi,
    /fontSize\s*:\s*['"]?([0-9]*\.?[0-9]+)px?['"]?/g,
    /text-\[([0-9]*\.?[0-9]+)px\]/g,
    /\.attr\(['"]font-size['"],\s*['"]?([0-9]*\.?[0-9]+)px?['"]?\)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(line)) !== null) {
      sizes.push(Number(match[1]))
    }
  }

  return sizes
}

function lineHeightsInLine(line) {
  const ratios = []
  const patterns = [
    /line-height\s*:\s*([0-9]*\.?[0-9]+)\s*(?:;|,|$)/gi,
    /lineHeight\s*:\s*['"]?([0-9]*\.?[0-9]+)['"]?/g,
    /leading-\[([0-9]*\.?[0-9]+)\]/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(line)) !== null) {
      const value = Number(match[1])
      if (Number.isFinite(value) && value > 0 && value < 5) ratios.push(value)
    }
  }

  return ratios
}

function auditMotion(files, limits) {
  const findings = []

  for (const file of files) {
    const rel = relative(file)
    const contents = readFileSync(file, "utf8")
    const hasMotion = /\b(?:transition|animation)\b/.test(contents)
    if (!hasMotion) continue

    if (!contents.includes("prefers-reduced-motion")) {
      findings.push(finding("warn", "motion", rel, "Motion declarations present without a same-file prefers-reduced-motion path."))
    }

    contents.split("\n").forEach((line, index) => {
      if (!/\b(?:transition|animation)\b/.test(line)) return

      for (const duration of durationsInLine(line)) {
        if (duration > limits.motionAbsoluteMaxMs) {
          findings.push(finding("fail", "motion", `${rel}:${index + 1}`, `Motion duration ${duration}ms exceeds ${limits.motionAbsoluteMaxMs}ms absolute max.`, {
            source: line.trim().slice(0, 180),
          }))
        } else if (duration > limits.motionMaxMs || (duration > 0 && duration < limits.motionMinMs)) {
          findings.push(finding("warn", "motion", `${rel}:${index + 1}`, `Motion duration ${duration}ms is outside ${limits.motionMinMs}-${limits.motionMaxMs}ms range.`, {
            source: line.trim().slice(0, 180),
          }))
        }
      }

      if (/\binfinite\b/.test(line)) {
        findings.push(finding("warn", "motion", `${rel}:${index + 1}`, "Infinite animation requires an explicit reduced-motion escape hatch.", {
          source: line.trim().slice(0, 180),
        }))
      }
    })
  }

  return findings
}

function durationsInLine(line) {
  const durations = []
  const pattern = /([0-9]*\.?[0-9]+)\s*(ms|s)\b/g
  let match
  while ((match = pattern.exec(line)) !== null) {
    const value = Number(match[1])
    durations.push(match[2] === "s" ? value * 1000 : value)
  }
  return durations
}

function auditFocusContract(files) {
  const contents = files.map((file) => readFileSync(file, "utf8")).join("\n")
  if (contents.includes(":focus-visible")) {
    return [finding("pass", "focus", "CommonPlace focus-visible", "At least one CommonPlace focus-visible contract is present.")]
  }
  return [finding("fail", "focus", "CommonPlace focus-visible", "No focus-visible contract found in CommonPlace static sources.")]
}

function auditDataVizStatics(files) {
  const findings = []

  if (files.length === 0) {
    return [finding("pending", "data-viz", "static source list", "No data visualization source files were found from the checklist.")]
  }

  for (const file of files) {
    const rel = relative(file)
    const contents = readFileSync(file, "utf8")
    if (/\bNaN\b/.test(contents) && !/Number\.isNaN|isNaN/.test(contents)) {
      findings.push(finding("warn", "data-viz", rel, "NaN is referenced without an obvious guard."))
    }
    if (/Infinity/.test(contents) && !/Number\.isFinite|isFinite/.test(contents)) {
      findings.push(finding("warn", "data-viz", rel, "Infinity is referenced without an obvious finite guard."))
    }
    if (/scale(?:Linear|Time|Band|Ordinal)|extent\(|domain\(/.test(contents) && !/legend|axis|label/i.test(contents)) {
      findings.push(finding("warn", "data-viz", rel, "Scale/domain code lacks obvious axis, legend, or label text in the same file."))
    }
  }

  findings.push(finding("pending", "data-viz", "rendered visual math", "Rendered data-viz checks still need browser/canvas assertions for axes, labels, domains, and finite coordinates."))
  return findings
}

async function auditRenderSeam(routes, baseUrl, limits) {
  const findings = []
  const timeoutMs = limits.routeSmokeTimeoutMs ?? 10000

  if (!baseUrl) {
    for (const route of routes) {
      findings.push(finding("pending", "render", route.id, `Route render checks pending. Re-run with --base-url=http://localhost:3040 for HTTP smoke; axe/APG still need browser tooling.`, {
        path: route.path,
        checks: route.renderChecks,
      }))
    }
    return findings
  }

  const paths = Array.from(new Set(routes.map((route) => route.path)))
  for (const routePath of paths) {
    const url = `${baseUrl}${routePath}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
      })
      const severity = response.status >= 200 && response.status < 400 ? "pass" : "fail"
      findings.push(finding(severity, "render-http", routePath, `HTTP ${response.status} from ${url}.`, {
        status: response.status,
        url,
      }))
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError"
      const message = aborted
        ? `Timed out after ${timeoutMs}ms fetching ${url}.`
        : `Unable to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`
      findings.push(finding("fail", "render-http", routePath, message, {
        timeoutMs,
        url,
      }))
    } finally {
      clearTimeout(timeout)
    }
  }

  for (const route of routes) {
    findings.push(finding("pending", "render", route.id, "Axe, APG, keyboard, and target-size checks are listed but not wired in this static Node audit yet.", {
      checks: route.renderChecks.filter((check) => check !== "http-ok"),
      path: route.path,
    }))
  }

  return findings
}

function summarize(findings) {
  const summary = { fail: 0, pass: 0, pending: 0, warn: 0 }
  for (const item of findings) summary[item.severity] += 1
  return summary
}

function printReport(report, maxFindings) {
  const { summary } = report
  console.log("CommonPlace quality audit")
  console.log(`scope: ${report.scope}`)
  if (report.baseUrl) console.log(`baseUrl: ${report.baseUrl}`)
  console.log(`pass ${summary.pass}  warn ${summary.warn}  fail ${summary.fail}  pending ${summary.pending}`)

  const visible = report.findings.filter((item) => item.severity !== "pass").slice(0, maxFindings)
  if (visible.length > 0) {
    console.log("")
    for (const item of visible) {
      console.log(`${item.severity.padEnd(7)} ${item.axis.padEnd(12)} ${item.target} :: ${item.message}`)
    }
    const hidden = report.findings.filter((item) => item.severity !== "pass").length - visible.length
    if (hidden > 0) console.log(`...and ${hidden} more non-pass findings.`)
  }

  if (summary.fail > 0) {
    console.error("\nCommonPlace quality audit failed.")
  } else {
    console.log("\nCommonPlace quality audit completed without hard failures.")
  }
}

function writeReport(outputPath, report) {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.join(ROOT, outputPath)
  try {
    mkdirSync(path.dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(`Report written: ${path.relative(ROOT, absolutePath)}`)
  } catch (err) {
    console.warn(`Report write skipped: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function resolveColor(value, tokenMap, stack = []) {
  if (!value) return null
  const raw = String(value).trim()
  const varMatch = raw.match(/^var\(\s*(--[\w-]+)(?:\s*,\s*([^)]+))?\s*\)$/)
  if (varMatch) {
    const token = varMatch[1]
    if (stack.includes(token)) return null
    const entry = tokenMap.get(token)
    if (entry) return resolveColor(entry.raw, tokenMap, [...stack, token])
    return varMatch[2] ? resolveColor(varMatch[2], tokenMap, stack) : null
  }

  const hex = raw.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  if (hex) return hexColor(hex[1])

  const rgb = raw.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/)
  if (rgb) {
    return {
      alpha: rgb[4] === undefined ? 1 : clamp(Number(rgb[4]), 0, 1),
      rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])],
    }
  }

  return null
}

function hexColor(hex) {
  const expanded =
    hex.length === 3
      ? hex.split("").map((char) => `${char}${char}`).join("")
      : hex.length === 8
        ? hex.slice(0, 6)
        : hex
  const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
  return {
    alpha,
    rgb: [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16)),
  }
}

function linearize(channel) {
  const value = channel / 255
  if (value <= 0.03928) return value / 12.92
  return ((value + 0.055) / 1.055) ** 2.4
}

function luminance(rgb) {
  return 0.2126 * linearize(rgb[0]) + 0.7152 * linearize(rgb[1]) + 0.0722 * linearize(rgb[2])
}

function contrastRatio(foreground, background) {
  const foregroundLum = luminance(foreground)
  const backgroundLum = luminance(background)
  const lighter = Math.max(foregroundLum, backgroundLum)
  const darker = Math.min(foregroundLum, backgroundLum)
  return (lighter + 0.05) / (darker + 0.05)
}

function composite(top, bottom) {
  return {
    alpha: 1,
    rgb: top.rgb.map((channel, index) => Math.round(channel * top.alpha + bottom.rgb[index] * (1 - top.alpha))),
  }
}

function rgbaString(color) {
  return color.alpha === 1
    ? `rgb(${color.rgb.join(", ")})`
    : `rgba(${color.rgb.join(", ")}, ${color.alpha.toFixed(2)})`
}

function finding(severity, axis, target, message, details = {}) {
  return {
    axis,
    details,
    message,
    severity,
    target,
  }
}

function compareFindings(a, b) {
  const rank = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  if (rank !== 0) return rank
  return `${a.axis}:${a.target}`.localeCompare(`${b.axis}:${b.target}`)
}

function relative(file) {
  return path.relative(ROOT, file)
}

function uniqueFiles(files) {
  return Array.from(new Set(files))
}

function trimSlash(url) {
  return url.replace(/\/+$/, "")
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
