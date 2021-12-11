const ss = SpreadsheetApp.getActiveSpreadsheet();
const ui = SpreadsheetApp.getUi();
const runningTransactionsSheetName = "Transactions (Running)";
const dateRangeTransactionsSheetName = "Transactions (Date Range)";
const accountBalancesSheetName = "Account Balances";
// Index values are zero indexed.
const accountBalancesMaskColumnNumber = 3;
const accountBalancesDateColumnNumber = 0;

const transactionsDateColumnNumber = 0;
const email = "";
