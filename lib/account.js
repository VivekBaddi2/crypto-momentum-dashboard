// Demo account management system for paper trading
export const INITIAL_BALANCE = 10000; // 10000 INR

export class DemoAccount {
  constructor() {
    this.balance = INITIAL_BALANCE;
    this.positions = {}; // symbol -> position object
    this.tradeHistory = []; // array of completed trades
    this.pendingOrders = {}; // symbol -> order object (for tracking SL/TP)
  }

  /**
   * Execute a trade based on signal and trade plan
   * @param {string} symbol - Trading pair symbol
   * @param {string} signal - BUY or SELL signal
   * @param {Object} tradePlan - Object containing entry, stopLoss, takeProfit, direction, etc.
   * @param {number} currentPrice - Current market price
   * @returns {Object|null} - Trade object if executed, null otherwise
   */
  executeTrade(symbol, signal, tradePlan, currentPrice) {
    // Only execute on confirmed BUY/SELL signals (not FORMING)
    if (signal !== 'BUY' && signal !== 'SELL') return null;

    // Don't trade if we already have a position in this symbol
    if (this.positions[symbol]) return null;

    // Validate trade plan
    if (!tradePlan || !tradePlan.entry || !tradePlan.stopLoss || !tradePlan.takeProfit) {
      return null;
    }

    // Calculate position size based on risk management (risk 2% of balance per trade)
    const riskPerTrade = this.balance * 0.02; // 2% risk
    const riskPerUnit = Math.abs(tradePlan.entry - tradePlan.stopLoss);

    if (riskPerUnit <= 0) return null;

    const quantity = riskPerTrade / riskPerUnit;
    const cost = quantity * tradePlan.entry;

    // Check if we have sufficient balance
    if (cost > this.balance) return null;

    // Determine direction from signal
    const direction = signal === 'BUY' ? 'LONG' : 'SHORT';

    // Create position object
    const position = {
      symbol,
      direction,
      entryPrice: tradePlan.entry,
      quantity,
      stopLoss: tradePlan.stopLoss,
      takeProfit: tradePlan.takeProfit,
      entryTime: Date.now(),
      currentPrice: currentPrice || tradePlan.entry,
      unrealizedPnl: 0,
      tradePlan: tradePlan
    };

    // Update balance (subtract cost for long, add for short? Actually for paper trading,
    // we don't need to actually transfer funds, just track P&L)
    // For simplicity, we'll track P&L separately and update balance when position closes

    // Store position
    this.positions[symbol] = position;

    // Create trade record
    const trade = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      direction,
      entryPrice: tradePlan.entry,
      quantity,
      stopLoss: tradePlan.stopLoss,
      takeProfit: tradePlan.takeProfit,
      entryTime: Date.now(),
      status: 'open',
      signal: signal,
      tradePlan: tradePlan
    };

    return trade;
  }

  /**
   * Update position with current price and check for SL/TP hits
   * @param {string} symbol - Trading pair symbol
   * @param {number} currentPrice - Current market price
   * @returns {Object|null} - Closed trade object if position closed, null otherwise
   */
  updatePosition(symbol, currentPrice) {
    const position = this.positions[symbol];
    if (!position) return null;

    // Update current price and unrealized P&L
    position.currentPrice = currentPrice;

    if (position.direction === 'LONG') {
      position.unrealizedPnl = (currentPrice - position.entryPrice) * position.quantity;

      // Check stop loss (price <= stop loss for long)
      if (currentPrice <= position.stopLoss) {
        return this.closePosition(symbol, currentPrice, 'stop_loss');
      }

      // Check take profit (price >= take profit for long)
      if (currentPrice >= position.takeProfit) {
        return this.closePosition(symbol, currentPrice, 'take_profit');
      }
    } else if (position.direction === 'SHORT') {
      position.unrealizedPnl = (position.entryPrice - currentPrice) * position.quantity;

      // Check stop loss (price >= stop loss for short)
      if (currentPrice >= position.stopLoss) {
        return this.closePosition(symbol, currentPrice, 'stop_loss');
      }

      // Check take profit (price <= take profit for short)
      if (currentPrice <= position.takeProfit) {
        return this.closePosition(symbol, currentPrice, 'take_profit');
      }
    }

    return null;
  }

  /**
   * Close a position and calculate realized P&L
   * @param {string} symbol - Trading pair symbol
   * @param {number} exitPrice - Exit price
   * @param {string} exitReason - Reason for exit (stop_loss, take_profit, manual)
   * @returns {Object} - Closed trade object
   */
  closePosition(symbol, exitPrice, exitReason) {
    const position = this.positions[symbol];
    if (!position) return null;

    // Calculate realized P&L
    let realizedPnl;
    if (position.direction === 'LONG') {
      realizedPnl = (exitPrice - position.entryPrice) * position.quantity;
    } else if (position.direction === 'SHORT') {
      realizedPnl = (position.entryPrice - exitPrice) * position.quantity;
    }

    // Update balance
    this.balance += realizedPnl;

    // Create closed trade object
    const closedTrade = {
      ...position,
      exitPrice,
      exitReason,
      exitTime: Date.now(),
      realizedPnl,
      duration: Date.now() - position.entryTime,
      status: 'closed'
    };

    // Add to trade history
    this.tradeHistory.push(closedTrade);

    // Remove from positions
    delete this.positions[symbol];

    return closedTrade;
  }

  /**
   * Get account summary statistics
   * @returns {Object} - Account analytics
   */
  getAccountSummary() {
    const closedTrades = this.tradeHistory.filter(t => t.status === 'closed');
    const winningTrades = closedTrades.filter(t => t.realizedPnl > 0);
    const losingTrades = closedTrades.filter(t => t.realizedPnl <= 0);

    const winRate = closedTrades.length > 0
      ? (winningTrades.length / closedTrades.length) * 100
      : 0;

    const totalProfit = closedTrades.reduce((sum, t) => sum + Math.max(t.realizedPnl, 0), 0);
    const totalLoss = closedTrades.reduce((sum, t) => sum + Math.min(t.realizedPnl, 0), 0);
    const netProfit = totalProfit + totalLoss; // totalLoss is negative

    return {
      balance: this.balance,
      initialBalance: INITIAL_BALANCE,
      totalReturn: ((this.balance - INITIAL_BALANCE) / INITIAL_BALANCE) * 100,
      openPositions: Object.keys(this.positions).length,
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: parseFloat(winRate.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalLoss: parseFloat(Math.abs(totalLoss).toFixed(2)), // positive value
      netProfit: parseFloat(netProfit.toFixed(2)),
      avgProfitPerTrade: closedTrades.length > 0
        ? parseFloat((netProfit / closedTrades.length).toFixed(2))
        : 0,
      recentTrades: this.tradeHistory.slice(-5).reverse(),
      allTrades: [...this.tradeHistory].reverse(),
      positions: Object.values(this.positions),
    };
  }

  /**
   * Reset account to initial state
   */
  reset() {
    this.balance = INITIAL_BALANCE;
    this.positions = {};
    this.tradeHistory = [];
    this.pendingOrders = {};
  }
}

// Create a singleton instance
export const demoAccount = new DemoAccount();