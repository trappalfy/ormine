// End-to-end run of the app against a local anvil deployment, driven through the real UI.
//
//   pnpm chain & pnpm deploy:local
//   cd web && NEXT_PUBLIC_CHAIN_ID=31337 NEXT_PUBLIC_E2E_ACCOUNT=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 pnpm build && pnpm start &
//   node scripts/e2e.mjs [screenshot dir]
//
// The player is anvil account #1 (connected by the app's e2e mock connector).
import puppeteer from "puppeteer-core";
import { readFileSync, mkdirSync } from "node:fs";
import { createPublicClient, createTestClient, http, parseEther, publicActions } from "viem";
import { anvil } from "viem/chains";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const SHOTS = process.argv[2] ?? "e2e-shots";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PLAYER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const dep = JSON.parse(readFileSync(new URL("../contracts/deployments/31337.json", import.meta.url)));
const artifact = (file, name) => JSON.parse(readFileSync(new URL(`../contracts/out/${file}.sol/${name}.json`, import.meta.url)));
const minersAbi = artifact("OrmineMiners", "OrmineMiners").abi;
const transport = http("http://127.0.0.1:8545");
const chain = anvil;
const pub = createPublicClient({ chain, transport });
const test = createTestClient({ chain, transport, mode: "anvil" }).extend(publicActions);

mkdirSync(SHOTS, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const step = (s) => console.log(`• ${s}`);
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const text = () => page.evaluate(() => document.body.innerText);
async function waitText(t, timeout = 30_000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
}
// Buttons only (nav links share labels like "Mint"); inside an open dialog first, since the toolbar and the
// dialog both have "Move" and "Upgrade".
async function click(label) {
  const ok = await page.evaluate((label) => {
    const scope = document.querySelector('[role="dialog"]') ?? document;
    const el = [...scope.querySelectorAll("button")].find((b) => b.textContent.trim() === label && !b.disabled);
    if (el) el.click();
    return !!el;
  }, label);
  if (!ok) throw new Error(`no enabled button "${label}"`);
}
async function waitEnabled(label, timeout = 30_000) {
  await page.waitForFunction(
    (label) => [...(document.querySelector('[role="dialog"]') ?? document).querySelectorAll("button")].some((b) => b.textContent.trim() === label && !b.disabled),
    { timeout },
    label,
  );
}
async function finishTx(name) {
  await page.waitForFunction(() => /Done\.|reverted|cancelled|Not enough|Something went wrong/.test(document.body.innerText), { timeout: 60_000 });
  const t = await text();
  if (!t.includes("Done.")) {
    await shot(`fail-${name}`);
    throw new Error(`${name}: transaction did not finish: ${t.slice(0, 400)}`);
  }
  await shot(`tx-${name}`);
  await click("Close");
}
const skip = async (seconds) => {
  await test.increaseTime({ seconds });
  await test.mine({ blocks: 1 });
};

// 1. Mint two Diggers into TSLA from /mint?vein=TSLA
step("mint 2 Diggers into TSLA");
await page.goto(`${APP}/mint?vein=TSLA`, { waitUntil: "networkidle0" });
await waitEnabled("Mint");
await page.click('button[aria-label="One more"]');
await waitText("0.04 ETH");
await shot("mint");
await click("Mint");
await finishTx("mint");
const minted = await pub.readContract({ address: dep.miners, abi: minersAbi, functionName: "balanceOf", args: [PLAYER] });
if (minted !== 2n) throw new Error(`expected 2 miners, got ${minted}`);

// 2. My mine shows them; two days later they have earned TSLA
step("my mine after two days");
await skip(2 * 86_400);
await page.goto(`${APP}/mine`, { waitUntil: "networkidle0" });
await waitText("Digging");
await page.waitForFunction(() => /TSLA pending [1-9]|TSLA pending 0\.\d*[1-9]/.test(document.body.innerText), { timeout: 30_000 });
await shot("mine");

// 3. Claim all → Claim TSLA
step("claim TSLA");
const tsla = (await pub.readContract({ address: dep.miners, abi: minersAbi, functionName: "veinInfo", args: [1] })).token;
const erc20 = artifact("ERC20", "ERC20").abi;
const before = await pub.readContract({ address: tsla, abi: erc20, functionName: "balanceOf", args: [PLAYER] });
await click("Claim all");
await waitEnabled("Claim TSLA");
await shot("claim-dialog");
await click("Claim TSLA");
await finishTx("claim");
const after = await pub.readContract({ address: tsla, abi: erc20, functionName: "balanceOf", args: [PLAYER] });
if (after <= before) throw new Error("claim paid nothing");
console.log(`  claimed ${Number(after - before) / 1e18} TSLA`);

// 4. Move the selected miner to NVDA
step("move miner #1 to NVDA");
await page.waitForSelector("tbody tr");
await page.click("tbody tr");
await click("Move");
await waitText("won't dig for");
await shot("move-dialog");
await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => l.textContent.includes("NVDA"))?.click());
await click("Move");
await finishTx("move");
await waitText("On the way");

// 5. Upgrade miner #2 for ETH; 70% of the price goes to its vein (TSLA)
step("upgrade miner #2");
const funder = artifact("VeinFunder", "VeinFunder").abi;
const pendingBefore = await pub.readContract({ address: dep.veinFunder, abi: funder, functionName: "ethPending", args: [1] });
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector("tbody tr");
const rows = await page.$$("tbody tr");
await rows[1].click();
await click("Upgrade");
await waitText("0.03 ETH");
await waitEnabled("Upgrade");
await shot("upgrade-dialog");
await click("Upgrade");
await finishTx("upgrade");
const tier = (await pub.readContract({ address: dep.miners, abi: minersAbi, functionName: "minerInfo", args: [2n] })).tier;
if (tier !== 2) throw new Error(`expected tier 2, got ${tier}`);
const funded = (await pub.readContract({ address: dep.veinFunder, abi: funder, functionName: "ethPending", args: [1] })) - pendingBefore;
if (funded !== parseEther("0.021")) throw new Error(`expected 0.021 ETH for the TSLA vein, got ${Number(funded) / 1e18}`);
console.log(`  paid 0.03 ETH, ${Number(funded) / 1e18} ETH set aside for TSLA`);

// 6. Read-only screens and the landing at two widths
step("screens");
for (const [w, h] of [[1440, 1000], [390, 844]]) {
  await page.setViewport({ width: w, height: h });
  for (const path of ["/", "/veins", "/mine", "/mint", "/docs"]) {
    await page.goto(`${APP}${path}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error(`${path} at ${w}px scrolls sideways by ${overflow}px`);
    await shot(`screen-${w}-${path === "/" ? "home" : path.slice(1)}`);
  }
}
const landing = await (async () => {
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${APP}/`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector("#veins")?.innerText.includes("TSLA"), { timeout: 20_000 });
  return page.evaluate(() => document.querySelector("#veins")?.parentElement?.innerText ?? "");
})();
if (landing.includes("Can't reach the chain")) throw new Error("landing veins did not load live data");

await browser.close();
const relevant = errors.filter((e) => !/WalletConnect|walletconnect|Reown|favicon|Lit is in dev mode/i.test(e));
if (relevant.length) {
  console.log("console errors:\n  " + relevant.join("\n  "));
  process.exit(1);
}
console.log("e2e passed");
