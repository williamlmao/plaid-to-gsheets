/**
 * Excludes existing transactions by checking transaction IDs
 * Filters out excluded accounts
 * Automatically corrects the category
 * Automatically adds owner, split, and the amounts
 * @param {*} transactions
 * @param {*} accounts
 * @param {*} includeHeader
 * @param {*} account
 * @returns
 */
const cleanTransactions = (
  transactions,
  accounts,
  includeHeader,
  owner,
  account
) => {
  const transactionIds = getTransactionIds("M");
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

    // Filter out existing transactions
    if (transactionIds.includes(transaction.transaction_id)) {
      return;
    }

    transactionOwner = owner;

    const PlaidCat1 = transaction.category[0] ? transaction.category[0] : "";
    const PlaidCat2 = transaction.category[1] ? transaction.category[1] : "";
    const PlaidCat3 = transaction.category[2] ? transaction.category[2] : "";

    const getCategory = () => {
      // General categorization - everything runs through this to get initial guess at categorization
      let category = PlaidCat1;
      if (PlaidCat3 !== "") {
        category = plaidCategory3Map[PlaidCat3];
      } else if (PlaidCat2 !== "") {
        category = plaidCategory2Map[PlaidCat2];
      } else if (PlaidCat1 === "Service") {
        category = "Misc";
      }
      // Specific categorization
      if (transaction.name.includes("Amazon")) {
        category = "Amazon";
        return category;
      }
      if (transaction.name.includes("CONSERVICE LLC")) {
        category = "Rent";
        return category;
      }
      return category;
    };

    const getTransactionType = () => {
      const checkName = (term) => {
        let tname = transaction.name.toLowerCase();
        term = term.toLowerCase();
        if (tname.includes(term)) {
          console.log(tname, term, true);
          return true;
        } else {
          return false;
        }
      };
      // Expense, Income, Credit Card Payment, Internal account transfer
      if (checkName("DISCOVER BANK P2P WILLIAM LIU WEB ID: 1770527921")) {
        return "Internal Account Transfer";
      } else if (PlaidCat1 === "Payment" && PlaidCat2 === "Credit Card") {
        return "Credit Card Payment";
      } else if (
        PlaidCat2 === "Internal Account Transfer" ||
        checkName("Discover High Yield") ||
        checkName("GOLDMAN SACHS BA COLLECTION") ||
        checkName("ACH Transfer to JPMORGAN CHASE BANK")
      ) {
        return "Internal Account Transfer";
      } else if (
        PlaidCat1 === "Transfer" &&
        PlaidCat2 === "Payroll" &&
        transaction.amount < 0
      ) {
        return "Income";
      } else if (PlaidCat1 === "Tax" && PlaidCat2 === "Refund") {
        return "Income";
      } else if (
        PlaidCat3 === "Coinbase" ||
        checkName("Coinbase") ||
        checkName("Robinhood") ||
        checkName("WEBULL") ||
        checkName("Manual DB-Bkrg") ||
        checkName("Manual CR-Bkrg") ||
        (PlaidCat1 === "Transfer" &&
          PlaidCat2 === "Withdrawal" &&
          PlaidCat3 == "")
      ) {
        return "Investment Account Transfer";
      } else if (checkName("MEALPAL PAYMENT")) {
        return "Income";
      } else if (PlaidCat2 === "Interest Earned") {
        return "Income";
      } else if (
        PlaidCat3 === "Venmo" ||
        transaction.name.includes("Cash App") ||
        transaction.name.includes("Zelle")
      ) {
        return "Payment App Transfer";
      } else if (PlaidCat1 === "Transfer" && PlaidCat2 === "Deposit") {
        return "Income";
      } else if (PlaidCat1 === "Transfer" && PlaidCat2 === "Credit") {
        return "Income";
      } else if (transaction.amount < -750) {
        return "Income";
      } else {
        return "Expense";
      }
    };

    // Maps the transaction data into the correct order
    let arr = [
      transaction.date,
      transaction.name,
      merchantName,
      transaction.payment_channel,
      transaction.iso_currency_code,
      PlaidCat1,
      PlaidCat2,
      PlaidCat3,
      transaction.category_id,
      transaction.transaction_type,
      getTransactionType(),
      transaction.transaction_id,
      mask,
      accounts[account_id].name,
      accounts[account_id].type,
      accounts[account_id].subtype,
      transaction.location.address,
      transaction.location.city,
      transaction.location.region,
      transaction.location.postal_code,
      transaction.location.country,
      transaction.location.store_number,
      getCategory(),
      transactionOwner, //owner
      transaction.amount,
    ];
    result.push(arr);
  });
  //   Should headers be included?
  if (includeHeader) {
    result.unshift(tableHeaders);
  }
  console.log("result", result);
  return result;
};

const insertRow = (sheetName, rowData, optIndex) => {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var index = optIndex || 1;
    sheet
      .insertRowBefore(index)
      .getRange(index, 1, 1, rowData.length)
      .setValues([rowData]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
};

const writeDataToBottomOfTab = (tabName, datas) => {
  if (datas.length === 0) {
    console.log("No data to write");
    return;
  }
  var SS = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = SS.setActiveSheet(SS.getSheetByName(tabName));
  var lastRow = sheet.getLastRow() + 1;
  var lastColumn = sheet.getLastColumn() + 1;
  var rows = datas.length;
  var cols = datas[1].length;
  var writeResult = sheet.getRange(lastRow, 1, rows, cols).setValues(datas);
  SpreadsheetApp.flush();
  return writeResult;
};

/**
 * Left aligns all cells in the spreadsheet and sorts by date
 */
const cleanup = (sheetName, dateColumnPosition) => {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).activate();
  sheet.getActiveRangeList().setHorizontalAlignment("left");
  sheet.sort(dateColumnPosition, false);
  console.log(`${sheetName} has been cleaned up`);
};

/**
 * Returns the date in a Plaid friendly format, e.g. YYYY-MM-DD
 */
const formatDate = (date) => {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
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
  var sheet = ss.getSheetByName(transactionsSheetName);

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
const getTransactionIds = (columnLetter) => {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(transactionsSheetName);
  let transactionIds = sheet
    .getRange(`${columnLetter}2:${columnLetter}`)
    .getValues()
    .flat();
  // filter out blank values
  transactionIds = transactionIds.filter((id) => id !== "");
  return transactionIds;
};

const alertViaEmail = (owner, account, func, error) => {
  MailApp.sendEmail(
    "willliuwillliu@gmail.com",
    `WAWAMONEYV2 - ${owner} - ${account} - ${func}`,
    `Error: ${JSON.stringify(
      error
    )} ____ https://docs.google.com/spreadsheets/d/1g6qZ4XN2_hf7RLrJUKM4TDi5VgQdB4_HKCTUpeieaRg/edit#gid=822001289`
  );
};

const reconcile = () => {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let reconciliationSheet = ss.getSheetByName("Reconciliation");
  let start = reconciliationSheet.getRange("B1").getValue();
  let end = reconciliationSheet.getRange("B2").getValue();
  let oweRange = reconciliationSheet.getRange("A5:C19");
  let tableRange = reconciliationSheet.getRange("A20:AG");
  oweRange.clear();
  tableRange.clear();
  let transactions = ss
    .getSheetByName("Transactions")
    .getDataRange()
    .getValues();
  const headers = transactions.shift();
  // get header indexes
  // filter transactions between start and end date
  let filteredTransactions = transactions.filter((transaction) => {
    let date = new Date(transaction[headers.indexOf("Date")]);
    if (
      date >= start &&
      date <= end &&
      transaction[headers.indexOf("Owner")] !==
        transaction[headers.indexOf("Split")]
    ) {
      return true;
    }
  });

  // Create object where key is owner and value is split
  let ownerSplitMap = {};
  filteredTransactions.forEach((transaction) => {
    let owner = transaction[headers.indexOf("Owner")];
    let split = transaction[headers.indexOf("Split")];
    if (ownerSplitMap[owner]) {
      if (ownerSplitMap[owner][split]) {
        ownerSplitMap[owner][split] += transaction[headers.indexOf("Amount")];
      } else {
        ownerSplitMap[owner][split] = transaction[headers.indexOf("Amount")];
      }
    } else {
      let splitObj = {};
      splitObj[split] = transaction[headers.indexOf("Amount")];
      ownerSplitMap[owner] = splitObj;
    }
  });

  let result = [["Owner", "Owed To", "Amount"]];
  for (let owedTo in ownerSplitMap) {
    for (let ower in ownerSplitMap[owedTo]) {
      result.push([ower, owedTo, ownerSplitMap[owedTo][ower]]);
    }
  }
  reconciliationSheet
    .getRange(4, 1, result.length, result[0].length)
    .setValues(result);
  // Write filtered transactions on row 15 of reconciliationSheet
  filteredTransactions.unshift(headers);
  reconciliationSheet
    .getRange(
      20,
      1,
      filteredTransactions.length,
      filteredTransactions[0].length
    )
    .setValues(filteredTransactions);
};

/**
 * Gets the start date by looking at row 2 of a specified column. Assumes the dataset is sorted. If the column is empty, returns the current date minus buffer.
 * @param {*} buffer
 * @param {*} dateColumnLetter
 * @returns
 */
const getStartDate = (buffer, dateColumnLetter) => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(transactionSheetName);
  console.log(`${dateColumnLetter}:2`);
  const val = sheet.getRange(`${dateColumnLetter}2`).getValue();
  console.log(val);
  let start_date;
  if (val == "") {
    start_date = new Date();
  } else {
    start_date = new Date(val);
  }
  start_date.setDate(start_date.getDate() - buffer);
  return start_date;
};
