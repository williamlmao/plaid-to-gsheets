const onOpen = () => {
  ui.createMenu("Plaid API Ingest")
    .addItem("Import Latest Transactions", "importLatest")
    .addItem("Import Date Range", "importByDateRange")
    .addItem("Set up", "setUp")
    .addToUi();
};

/**
 * Updates transactions so that the schema matches the sheet. Converts from array of objects to 2D array.
 * Removes existing transactions
 * Removes pending transactions
 * @param {*} transactions
 * @param {*} owner
 * @param {*} account
 * @returns
 */
const cleanTransactions = (
  transactions,
  accounts,
  owner,
  account,
  filterForTransactionIds
) => {
  const transactionIds = getTransactionIds();
  let result = [];
  transactions.forEach((transaction) => {
    let account_id = transaction.account_id;
    let mask = accounts[account_id].mask;
    let merchantName =
      transaction.merchant_name != null
        ? transaction.merchant_name
        : transaction.name;

    // Filter out pending transactions
    if (transaction.pending === true) {
      return;
    }

    if (filterForTransactionIds) {
      if (transactionIds.includes(transaction.transaction_id)) {
        return;
      }
    }

    const getTransactionType = () => {
      let transactionType = "Expense";

      // Internal Account Transfer
      if (PlaidCat2 === "Internal Account Transfer") {
        transactionType = "Internal Account Transfer";
      }
      // Investment Account Transfer
      if (
        (PlaidCat1 === "Transfer" && transaction.name.includes("Bkrg")) ||
        PlaidCat3 === "Coinbase"
      ) {
        transactionType = "Investment Account Transfer";
      }
      if (
        PlaidCat3 === "Venmo" ||
        transaction.name.includes("Zelle") ||
        transaction.name.includes("Cash App")
      ) {
        // Payment App Transfer
        transactionType = "Payment App Transfer";
      }
      // Credit Card Payment
      if (PlaidCat2 === "Plaid Category 2") {
        transactionType = "Credit Card Payment";
      }
      // Income (negative numbers are credits)
      if (
        (PlaidCat2 === "Deposit" ||
          PlaidCat2 === "Payroll" ||
          PlaidCat2 === "Interest Earned") &&
        transaction.amount < 0
      ) {
        transactionType = "Income";
      }
      return transactionType;
    };

    const PlaidCat1 = transaction.category[0] ? transaction.category[0] : "";
    const PlaidCat2 = transaction.category[1] ? transaction.category[1] : "";
    const PlaidCat3 = transaction.category[2] ? transaction.category[2] : "";
    const updatedTransaction = {
      Date: transaction.date,
      Name: transaction.name,
      "Marchant Name": merchantName,
      "Payment Channel": transaction.payment_channel,
      "ISO Currency Code": transaction.iso_currency_code,
      "Plaid Category 1": PlaidCat1,
      "Plaid Category 2": PlaidCat2,
      "Plaid Category 3": PlaidCat3,
      "Category ID": transaction.category_id,
      "Transaction Space": transaction.transaction_type,
      "Transaction Type": getTransactionType(),
      "Transaction ID": transaction.transaction_id,
      Owner: owner,
      Account: account,
      Mask: mask,
      "Account Name": accounts[account_id].name,
      "Account Type": accounts[account_id].type,
      "Account Subtype": accounts[account_id].subtype,
      Address: transaction.location.address,
      City: transaction.location.city,
      Region: transaction.location.region,
      "Postal Code": transaction.location.postal_code,
      Country: transaction.location.country,
      "Store Number": transaction.location.store_number,
      Category: PlaidCat1,
      Amount: transaction.amount,
      Rollup: "Rollup",
    };
    result.push(updatedTransaction);
  });
  return result;
};

const transformTransactions = (transactions) => {
  let transformedTransactions = applyRulesToData(transactions);
  // Turn ruled data back into a 2D array
  transformedTransactions = transformedTransactions.map((row) =>
    Object.keys(row).map((key) => row[key])
  );
  // // If includeHeaders is true, add the headers to the top of the array
  // if (includeHeaders && transactions[0]) {
  //   transformedTransactions.unshift(
  //     Object.keys(transactions[0]).map((key) => key)
  //   );
  // }
  return transformedTransactions;
};

const writeDataToBottomOfTab = (tabName, data, clearTab) => {
  if (data.length === 0 || !data) {
    console.log("No data to write");
    return;
  }

  let writeSS = SpreadsheetApp.getActiveSpreadsheet();
  let writesheet = writeSS.setActiveSheet(writeSS.getSheetByName(tabName));

  if (clearTab) {
    writesheet.clear();
  }
  const lastRow = writesheet.getLastRow() + 1;
  const lastColumn = writesheet.getLastColumn() + 1;
  const rows = data.length;
  const cols = data[0].length;
  const writeResult = writesheet
    .getRange(lastRow, 1, rows, cols)
    .setValues(data);
  SpreadsheetApp.flush();
  return writeResult;
};

/**
 * Left aligns all cells in the spreadsheet and sorts by date
 */
const cleanup = (sheetName) => {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).activate();
  sheet.getActiveRangeList().setHorizontalAlignment("left");
  console.log("bounds", transactionsDateColumnNumber + 1);
  sheet.sort(transactionsDateColumnNumber + 1, false);
  console.log(`${sheetName} has been cleaned up`);
};

/**
 * Returns the date in a Plaid friendly format, e.g. YYYY-MM-DD
 */
const formatDate = (date) => {
  if (date) {
    var d = new Date(date),
      month = "" + (d.getMonth() + 1),
      day = "" + d.getDate(),
      year = d.getFullYear();

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;

    return [year, month, day].join("-");
  } else {
    return undefined;
  }
};

const getHeaders = (sheetName) => {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  let data = sheet.getDataRange().getValues();
  let headers = data[0];
  return headers;
};

/**
 * Removes transactions from the spreadsheet
 */
const reset = () => {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(runningTransactionsSheetName);

  var last_row = sheet.getLastRow();
  sheet.getRange("2:" + last_row).activate();
  sheet
    .getActiveRangeList()
    .clear({ contentsOnly: true, skipFilteredRows: true });
};

/**
 * Accounts is an object generated from the /get transactions endpoint. But transactions don't contain account info so this needs to be supplemented.
 * @param {} accounts
 * @returns
 */
const getAccountsMap = (accounts) => {
  let result = {};
  accounts.forEach((account) => {
    result[account.account_id] = account;
  });
  return result;
};

/**
 * Returns array of transaction IDs
 */
const getTransactionIds = () => {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(runningTransactionsSheetName);
  let transactionIds = sheet
    .getRange(1, transactionIdColumnNumber + 1, sheet.getLastRow() + 1, 1)
    .getValues()
    .flat();
  // filter out blank values
  transactionIds = transactionIds.filter((id) => id !== "");
  return transactionIds;
};

const alertViaEmail = (owner, account, func, error) => {
  if (email) {
    MailApp.sendEmail(
      email,
      `Plaid To Google Sheets - ${owner} - ${account} - ${func}`,
      `Error: ${JSON.stringify(error)}`
    );
  }
};

/**
 * Gets the start date by looking at row 2 of a specified column. Assumes the dataset is sorted.
 * @returns the start date to send to plaid API
 */
const getStartDate = () => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(runningTransactionsSheetName);
  const val = sheet.getRange(2, transactionsDateColumnNumber + 1).getValue();
  let start_date;
  // If there is no data in the column, the start date is the current date minus 800 days which should get the last 2 years of data (plaid's max)
  if (val == "") {
    start_date = new Date();
    start_date.setDate(start_date.getDate() - 800);
  } else {
    // If there a latest date, use the latest minus the 10 days to account for any transactions that may have been processed
    start_date = new Date(val);
    start_date.setDate(start_date.getDate() - 10);
  }
  return start_date;
};

const getJsonArrayFromData = (data) => {
  var obj = {};
  var result = [];
  var headers = data[0];
  var cols = headers.length;
  var row = [];

  for (var i = 1, l = data.length; i < l; i++) {
    // get a row to fill the object
    row = data[i];
    // clear object
    obj = {};
    for (var col = 0; col < cols; col++) {
      // fill object with new values
      obj[headers[col]] = row[col];
    }
    // add object in a final result
    result.push(obj);
  }

  return result;
};

const importOtherAccounts = () => {
  // Get all sheets that contain the word "Ingest"
  let sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  let ingestSheets = sheets.filter((sheet) =>
    sheet.getName().includes("Ingest")
  );
  let accountHeaderMap = getAccountHeaderMap();
  // For each ingestSheet, check the Other Account Map sheet and grab the
  ingestSheets.forEach((sheet) => {
    let sheetName = sheet.getName();
    sheetName = sheetName.replace("Ingest", "");
    sheetName = sheetName.trim();
    // Get headers from the sheet
    let data = sheet.getDataRange().getValues();
    let headers = data.shift();
    let result = [];
    if (!accountHeaderMap[sheetName]) {
      ui.alert(
        `The ${sheetName} account you are trying to ingest does not have a corresponding row in the Account Header Map sheet. Please make sure that there is a row present and that the value in column A matches the text you have in the ingest tab. `
      );
    }
    data.forEach((row) => {
      let transaction = {};
      // Loop through transaction headers and find the matching header in the Other Account Map sheet
      transactionHeaders.forEach((header) => {
        let otherAccountHeader = accountHeaderMap[sheetName][header];
        // If the other account header is found, add the value to the row
        if (headers.indexOf(otherAccountHeader) > -1) {
          transaction[header] = row[headers.indexOf(otherAccountHeader)];
        } else {
          transaction[header] = accountHeaderMap[sheetName][header];
        }
      });
      result.push(transaction);
    });
    result = transformTransactions(result, false);
    // Write result to bottom of transactions and then clear the ingest sheet
    writeDataToBottomOfTab(runningTransactionsSheetName, result, false);
    cleanup("Transactions (Running)");
    sheet.clear();
    let currentTime = new Date();
    sheet
      .getRange("A1")
      .setValue(
        `The ${sheetName} data that was here was ingested to Transactions (Running) at ${currentTime.toISOString()}. You can clear this message and use this sheet again.`
      );
  });
};

/**
 * Used to create a lookup table to normalize other reports into the same format as the transaction report
 * @returns {Object} To lookup the resp
 */
const getAccountHeaderMap = () => {
  let accountHeaderMapData = ss
    .getSheetByName("Account Header Map")
    .getDataRange()
    .getValues();
  let accountHeaderMap = {};
  let transactionsRow = accountHeaderMapData[0];
  accountHeaderMapData.forEach((row, index) => {
    let headerMap = {};
    row.forEach((header, index) => {
      headerMap[transactionsRow[index]] = header;
    });
    accountHeaderMap[row[0]] = headerMap;
  });
  console.log(accountHeaderMap);
  return accountHeaderMap;
};
