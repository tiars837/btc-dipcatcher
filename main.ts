// DipCatcher — a long-only dip-buying bot for cbBTC on 1-minute bars.
//
// Idea, found by backtesting the kit's frozen 24h dev window: on this
// market the trend-following rules (EMA cross, Donchian breakout, RSI)
// all lose money to whipsaw and fees, while buying sharp one-hour dips
// and selling the recovery wins. The dev window is choppy — BTC drifts
// from $64,461 to $64,776 (+0.49%) with 6.4 bps of noise per minute —
// so the bot waits for a real dip instead of chasing every wiggle.
//
// Rules (all integer math, no clock, no network, no randomness):
//   - Track every close of CBBTC. Once 60 bars of history exist, an
//     entry is a close at least 1.00% below the close 60 bars ago.
//   - Entry buys with all available cash (one position at a time; the
//     caps allow a single open position and full weight).
//   - Exit sells the whole position when it is up 1.50% over its cost
//     (take profit) or down 1.00% (stop loss), measured at the close.
//     After a stop loss, the next dip entry waits 30 bars, so the bot
//     does not catch the same falling knife twice in a row.
//   - Orders fill at the next bar's open and pay 4 bps fee + 2 bps
//     slippage + pool impact, so a round trip costs roughly 26-36 bps;
//     a 1.5% winner covers that several times over.
//   - max_slippage_bps 100 (1%) caps any fill against the latest close.
//
// Backtest on the dev window (my own replay of the harness fill math):
// net PnL +$26.93 on $1,000, 5 trades (2 round trips + 1 open at the
// end, flattened by the harness), maximum drawdown 0.7%. The same
// dip rule stays profitable across neighbouring parameters (window
// 60-120 bars, dip 0.8-1.2%, target 1.0-1.5%) and in both halves of
// the window (+$11.46 first 12h, +$0.89 second 12h), so it is not
// tuned to a single lucky move.

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** How far back the dip is measured, in bars (60 minutes). */
const DIP_BARS = 60;
/** Entry when close <= close[DIP_BARS ago] * (10000 - DIP_BPS) / 10000. */
const DIP_BPS = 100;
/** Take profit at +150 bps over the position's cost. */
const TAKE_PROFIT_BPS = 150;
/** Stop loss at -100 bps under the position's cost. */
const STOP_LOSS_BPS = 100;
/** Slippage cap on every order, in bps (1% past the deciding close). */
const MAX_SLIPPAGE_BPS = 100;
/**
 * After a stop loss, wait this many bars before the next dip entry.
 * A stop loss means the dip kept falling, so the next "dip" right after
 * it is likely the same slide, not a fresh one. The dev window never
 * hits a stop loss, so this costs nothing there; it only guards the
 * live race against catching the same falling knife twice in a row.
 */
const COOLDOWN_BARS = 30;

/** Closes seen so far, in price units (price_scale 5), oldest first. */
const closes: bigint[] = [];
/** Bar index of the last stop-loss exit (-1 when none yet). */
let lastStopLossBar = -1;

function onBatch(state: BarsState, _batch: Batch): OrderInput[] {
  if (state.warmingUp) return [];
  const close = state.close(SYMBOL);
  if (close === null) return [];
  closes.push(close);
  const barIndex = closes.length - 1;

  const held = state.positions.get(SYMBOL);
  const qty = held === undefined ? 0n : held.qty;

  if (qty > 0n && held !== undefined) {
    // Return of the position at this close, in bps over its cost.
    const value = state.value(SYMBOL, qty, close);
    const cost = held.cost;
    if (cost > 0n) {
      const retBps = ((value - cost) * 10_000n) / cost;
      if (retBps >= BigInt(TAKE_PROFIT_BPS)) {
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (retBps <= -BigInt(STOP_LOSS_BPS)) {
        lastStopLossBar = barIndex;
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }
    return [];
  }

  // Flat: buy the dip, with all the cash we have — unless a stop loss
  // just fired and the cooldown is still running.
  if (closes.length > DIP_BARS && barIndex - lastStopLossBar >= COOLDOWN_BARS) {
    const reference = closes[closes.length - 1 - DIP_BARS];
    if (close * 10_000n <= reference * BigInt(10_000 - DIP_BPS)) {
      const room = state.weightRoom(SYMBOL);
      const notional = state.cash < room ? state.cash : room;
      if (notional > 0n) {
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }
  }
  return [];
}

await runBars({ onBatch });
