# DipCatcher — BTC dip-buying bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/tiars837/btc-dipcatcher/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/tiars837/btc-dipcatcher/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A long-only trading bot for Coinbase Wrapped BTC (cbBTC) on 1-minute
on-chain prices, built for the [make.fun bounty "Race a BTC trading bot
live for 24 hours"](https://make.fun/bounty/btc-race-24h-20261117-0603)
($250). Paper money only — nothing is traded for real.

## Strategy

Buy sharp one-hour dips and sell the recovery:

- **Entry:** the close is at least 1.00% below the close 60 bars ago.
  Buy with all available cash (one position at a time).
- **Exit:** sell everything at +1.50% over cost (take profit) or
  −1.00% under cost (stop loss), measured at the close.
- Orders fill at the next bar's open, pay 4 bps fee + 2 bps slippage +
  pool impact, and are capped at 1% slippage past the deciding close.

Why dips: on the frozen dev window, trend rules (EMA cross, Donchian,
RSI) all lose to whipsaw and fees, while this dip rule wins across
neighbouring parameters and in both halves of the window.

## Local result (dev window, official harness)

`node cli/makefun.mjs grade-local --kit <kit> --bot <repo> --driver process`

- Net PnL **+$27.02** on $1,000 starting capital (dev gate needs > $0)
- 5 trades, maximum drawdown 0.7% (guardrail: ≤ 25%)

## Run it

```sh
node main.ts
```

Node 22, standard library only. `vendor/makefun-bars.ts` is the kit's
bars-replay SDK shim, byte-identical. The bot speaks
`agent-fun/bars-replay/v1` on stdin/stdout: one JSON line per minute,
one reply per batch. Deterministic — no clock, no network, no
randomness, no files outside the repository.

## Layout

- `main.ts` — the bot (entrypoint).
- `vendor/makefun-bars.ts` — kit SDK shim, byte-identical.
- `README.md`, `LICENSE` — this file, MIT.

## License

MIT — see [LICENSE](LICENSE).
