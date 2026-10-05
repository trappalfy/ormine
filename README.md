# Ormine

NFT-шахтёры на Robinhood Chain, которые добывают токенизированные акции. Механика описана в `ORMINE_TECH_SPEC.md`, дизайн — в `ORMINE_DESIGN.md`.

```
contracts/        Foundry: OrmineMiners (NFT + жилы), VeinFunder (ETH → акции), тесты, скрипты деплоя
web/              Next.js 16: лендинг, приложение (/mint, /mine, /veins), документация (/docs)
packages/shared/  Константы механики, ABI и адреса для фронта (generated.ts пишет scripts/export-abi.mjs)
scripts/          Локальный деплой, выгрузка ABI, keeper
ormine-assets/    Исходные ассеты бренда
```

## Что нужно

Node 24, pnpm, Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`).

```bash
pnpm install
```

## Локальная разработка

Три терминала:

```bash
pnpm chain                # anvil
pnpm deploy:local         # контракты с mock-акциями, по 100 акций в каждой жиле, минт открыт
pnpm dev                  # сайт на http://localhost:3000 (web/.env.local: NEXT_PUBLIC_CHAIN_ID=31337)
```

В кошельке добавьте сеть `http://127.0.0.1:8545`, chain id 31337, и импортируйте тестовый ключ anvil #0. Он публичный, нигде больше его не используйте.

## Проверки

```bash
pnpm check                                         # типы, линтер, тесты shared и контрактов
cd contracts && FORK_MAINNET=true forge test --match-contract ForkMainnet   # реальные свопы на форке mainnet
cd contracts && forge coverage --ir-minimum --no-match-coverage "(test|script)/"
```

Результаты анализа безопасности — в `contracts/SECURITY.md`.

Сквозной тест через настоящий интерфейс (минт → клейм → переезд → апгрейд, плюс проверка вёрстки на 1440 и 390 px):

```bash
pnpm chain & pnpm deploy:local
cd web && NEXT_PUBLIC_CHAIN_ID=31337 NEXT_PUBLIC_E2E_ACCOUNT=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 pnpm build && pnpm start -p 3100 &
APP_URL=http://localhost:3100 node scripts/e2e.mjs
```

`NEXT_PUBLIC_E2E_ACCOUNT` подключает тестовый аккаунт anvil вместо кошелька и работает только с chain id 31337.

## Деплой контрактов

1. Заполните `contracts/.env` по образцу `contracts/.env.example`: владелец, казна, keeper (можно один адрес), адрес картинок NFT.
2. Импортируйте ключ деплойера в зашифрованное хранилище Foundry: `cast wallet import ormine-deployer --interactive`.
3. Testnet (46630; вместо акций ставятся mock-токены):
   ```bash
   cd contracts && source .env
   forge script script/Deploy.s.sol --rpc-url $ROBINHOOD_TESTNET_RPC_URL --account ormine-deployer --broadcast --verify --verifier blockscout --verifier-url https://explorer.testnet.chain.robinhood.com/api/
   ```
4. Mainnet (4663) — только по решению владельца. Тот же скрипт, но `--rpc-url $ROBINHOOD_RPC_URL` и `--verifier-url https://robinhoodchain.blockscout.com/api/`.
5. Если `OWNER` не совпадает с кошельком деплоя, вызовите с него `acceptOwnership()` у обоих контрактов.
6. Стартовый пул: скрипт покупает акции за ETH кошелька на Uniswap (не дешевле Chainlink больше чем на 1,5%) и кладёт их в жилы. Пул начинает отдаваться со следующей смены дня жилы (каждые сутки в момент деплоя, у mainnet — 18:57 UTC).
   ```bash
   cd contracts && SEED_WEI=$(cast to-wei 0.5) forge script script/SeedMainnet.s.sol --rpc-url $ROBINHOOD_RPC_URL --account ormine-deployer --sender $OWNER --broadcast
   ```
   `SEED_WEI` — ETH на каждую жилу; `SEED_WEI_NVDA` / `SEED_WEI_TSLA` / `SEED_WEI_AAPL` задают жилу отдельно (0 — пропустить).
7. Открыть минт: `cast send <OrmineMiners> "setMintPaused(bool)" false --account ormine-deployer --rpc-url $ROBINHOOD_RPC_URL`.
8. `pnpm abi` — адреса попадут во фронт (`packages/shared/src/generated.ts`), потом соберите сайт заново.
9. Разовый бонус шахтёрам: скрипт покупает акции на сумму в долларах и сразу рассылает их владельцам шахтёров, которые сейчас копают в жиле, по хешрейту. Жилы тут не участвуют: они отдают только 1% в день. Без `--broadcast` скрипт только печатает раздачу.
   ```bash
   cd contracts && BONUS_USD=20 forge script script/BonusMainnet.s.sol --rpc-url $ROBINHOOD_RPC_URL --account ormine-deployer --sender $OWNER --broadcast
   ```
   `BONUS_USD_NVDA` / `BONUS_USD_TSLA` / `BONUS_USD_AAPL` задают жилу отдельно (0 — пропустить).

## Keeper

Обменивает ETH, накопленный для жил, на акции. Запускать с кошелька, указанного как `KEEPER`:

```bash
KEEPER_KEY=0x... CHAIN_ID=4663 LOOP_MINUTES=60 node scripts/keeper.mjs
```

Контракт сам не пропустит обмен хуже курса Chainlink больше чем на 1,5% и больше 2 ETH за раз.

## Сайт на Vercel

Сайт: https://ormine.vercel.app, собирается из `main` на GitHub. Root directory — `web`, фреймворк — Next.js. Переменные — по образцу `web/.env.example`; без `NEXT_PUBLIC_CHAIN_ID` сайт работает с mainnet (4663).
