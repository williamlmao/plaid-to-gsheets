// *** EDIT BELOW THIS LINE ***
// Environment can either be 'sandbox' or 'development'. Keep this as 'sandbox' if you want to play around with the example data, or change this to 'development' once you have put in your own credentials.
const environment = "sandbox";
const client_id = "60df35af19a2660010f8b6e8";
const secret = "b9e93c1b33370097dbef1ae743fea6";
// You can include multiple accounts here under the same client. Use this format per account. Owner name, then account name.
// Owner: {
//   Account1: {
//     token: "access-sandbox-e5ad8ed8-e0c6-4b67-8681-279c0cf172b4",
//     earliestDate: "2019-07-29",
//   },
// },
const tokens = {
  Sandbox: {
    Chase: {
      token: "access-sandbox-a5d8d600-bf08-4cea-814c-497563ecc9ba",
      // Earliest date signified a hard stop of the earliest date to pull transactions.
      earliestDate: "2019-07-29",
    },
  },
};
// *** EDIT ABOVE THIS LINE ***

// *** NOT NECESSARY TO EDIT BELOW THIS LINE, BUT YOU CAN IF YOU WANT ***
const runningTransactionsSheetName = "Transactions (Running)";
const dateRangeTransactionsSheetName = "Transactions (Date Range)";
const accountBalancesSheetName = "Account Balances";
const importSettingsSheetName = "Import Settings";
const email = "";
const count = 500;

const transactionHeaders = [
  "Date",
  "Name",
  "Merchant Name",
  "Payment Channel",
  "ISO Currency Code",
  "Plaid Category 1",
  "Plaid Category 2",
  "Plaid Category 3",
  "Category ID",
  "Transaction Space",
  "Transaction Type",
  "Transaction ID",
  "Owner",
  "Account",
  "Mask",
  "Account Name",
  "Account Type",
  "Account Subtype",
  "Address",
  "City",
  "Region",
  "Postal Code",
  "Country",
  "Store Number",
  "Category",
  "Amount",
  "Rollup",
];
const accountBalanceHeaders = [
  "Date",
  "Owner",
  "Account ID",
  "Mask",
  "Name",
  "Official Name",
  "Account Type",
  "Account Subtype",
  "Currency",
  "Available Balance",
  "Value (USD)",
  "Limit",
];
// *** NOT NECESSARY TO EDIT ABOVE THIS LINE, BUT YOU CAN IF YOU WANT ***

// *** DO NOT EDIT BELOW THIS LINE ***
const developmentEndpoint = "https://development.plaid.com/transactions/get";
const sandboxEndpoint = "https://sandbox.plaid.com/transactions/get";
const transactionIdColumnNumber = transactionHeaders.indexOf("Transaction ID"); // Index values are zero indexed.
const accountBalancesMaskColumnNumber = accountBalanceHeaders.indexOf("Mask");
const accountBalancesDateColumnNumber = accountBalanceHeaders.indexOf("Date");
const transactionsDateColumnNumber = transactionHeaders.indexOf("Date");
const ss = SpreadsheetApp.getActiveSpreadsheet();
const ui = SpreadsheetApp.getUi();
