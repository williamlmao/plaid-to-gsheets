// Import all new transactions & account balances
const importAll = () => {
  let transactions = [];
  let accounts = [];
  // Start date is the latest transaction date minus buffer
  const start_date = formatDate(getStartDate(500, "A"));
  const end_date = formatDate(new Date());
  // Get all of the access tokens + account metadata
  const tokensProp = JSON.parse(
    PropertiesService.getScriptProperties().getProperty("tokens")
  );
  // For each access token, get all transactions and account balances. Normalize the data.
  for (let owner in tokensProp) {
    for (let account in tokensProp[owner]) {
      const accessToken = tokensProp[owner][account]["token"];
      let response = hitPlaidTransactionsEndpoint(
        start_date,
        end_date,
        owner,
        account,
        "sandbox"
      );

      let cleanedTransactions = cleanTransactions(
        response.transactions,
        getAccountsMap(response.accounts),
        true,
        owner,
        account
      );
      transactions = transactions.concat(cleanedTransactions);
      accounts = accounts.concat(response.accounts);
    }
  }
  writeDataToBottomOfTab(transactionSheetName, transactions);
  // cleanAccounts(accounts);
  // Write it to the sheet
};
// Import transactions from a specific range
// Import account balances for the current day
// Clean up the data

const testHitPlaidTransactionsEndpoint = () => {
  result = hitPlaidTransactionsEndpoint(
    "2020-01-01",
    "2021-10-01",
    "Sandbox",
    "Chase",
    "sandbox"
  );
  console.log("result", result);
};

/**
 * Primary function to grab data from the plaid API. Is able to grab >500 transactions.
 * @param {*} start_date
 * @param {*} end_date
 * @param {*} owner
 * @param {*} account
 * @param {*} env // 'sandbox', 'development', or leave it blank to default to 'development'
 */
const hitPlaidTransactionsEndpoint = (
  start_date,
  end_date,
  owner,
  account,
  env
) => {
  console.log(
    `Running getTransactionsFromRange from ${start_date} to ${end_date} for ${owner}'s ${account} account`
  );
  const url = `https://${
    env == "sandbox" ? "sandbox" : "development"
  }.plaid.com/transactions/get`;
  try {
    const tokensProp = JSON.parse(
      PropertiesService.getScriptProperties().getProperty("tokens")
    );
    let ACCESS_TOKEN_EARLIEST_DATE = tokensProp[owner][account]["earliestDate"];
    ACCESS_TOKEN_EARLIEST_DATE = new Date(ACCESS_TOKEN_EARLIEST_DATE);
    // Since transaction IDs are only unique to an access token. This prevents an duplicate transactions in the case an access token is swapped out and then the date range is adjusted to before the date the access token was swapped.
    if (ACCESS_TOKEN_EARLIEST_DATE > start_date) {
      start_date = ACCESS_TOKEN_EARLIEST_DATE;
    }
    const ACCESS_TOKEN = tokensProp[owner][account]["token"];
    const CLIENT_ID =
      PropertiesService.getScriptProperties().getProperty("client_id");
    const SECRET =
      PropertiesService.getScriptProperties().getProperty("secret");
    const COUNT = 500;
    // headers are a parameter plaid requires for the post request
    var headers = {
      contentType: "application/json",
      "Content-Type": "application/json",
    };
    // data is a parameter plaid requires for the post request.
    var data = {
      access_token: ACCESS_TOKEN,
      client_id: CLIENT_ID,
      secret: SECRET,
      start_date: start_date,
      end_date: end_date,
    };

    var parameters = {
      headers: headers,
      payload: JSON.stringify(data),
      method: "post",
      muteHttpExceptions: true,
    };
    // Configure the env in props.js. Plaid Sandbox uses a different endpoint.
    // Plaid has two endpoints. Demo is using sandbox. Defaults to development if
    var response = UrlFetchApp.fetch(url, parameters);
    response = JSON.parse(response);
    // parse the response into a JSON object
    let transactions = response.transactions;
    const total_transactions = response.total_transactions;
    // This is needed to generate the correct request parameters with the offset inside of the while loop
    // This part of the code was just used to pull historical data, but is not necessary for daily running.
    const updateRequestParameters = (transactions) => {
      var data = {
        access_token: ACCESS_TOKEN,
        client_id: CLIENT_ID,
        secret: SECRET,
        start_date: start_date,
        end_date: end_date,
        options: {
          offset: transactions.length,
        },
      };
      var parameters = {
        headers: headers,
        payload: JSON.stringify(data),
        method: "post",
        muteHttpExceptions: true,
      };
      return parameters;
    };

    try {
      while (transactions.length < total_transactions) {
        let paginatedResponse = UrlFetchApp.fetch(
          url,
          updateRequestParameters(transactions)
        );
        paginatedResponse = JSON.parse(paginatedResponse);
        transactions = transactions.concat(paginatedResponse.transactions);
      }
      let result = { transactions: transactions, accounts: response.accounts };
      return result;
    } catch (error) {
      // handle eror
      console.log(error);
    }
  } catch (e) {
    console.log(e.stack);
  }
};

/**
 * Runs import from 10 days (buffer) before the latest transaction date
 */
const run = () => {
  setProps();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(transactionSheetName);
  const val = sheet.getRange("B2").getValue();
  let start_date;
  if (val == "") {
    start_date = new Date();
  } else {
    start_date = new Date(val);
  }
  const buffer = 500;
  start_date.setDate(start_date.getDate() - buffer);
  var end_date = new Date();
  console.log(`Importing transactions between ${start_date} and ${end_date}`);
  try {
    getTransactionsFromRange(
      formatDate(start_date),
      formatDate(end_date),
      true,
      "Sandbox",
      "Chase",
      "sandbox"
    );
  } catch (e) {
    console.log(e);
  }
  // 10s pause to prevent the functions running synchronously
  Utilities.sleep(10000);
  cleanup(transactionSheetName, 1);
  // Date is 1st position
  cleanup(accountBalancesSheetName, 1);
};

/**
 * Grabs transactions for specified date range in YYYY-MM-DD format
 * @param {*} start_date
 * @param {*} end_date
 */
const runSpecific = (start_date, end_date, owner, account) => {
  console.log(
    `Importing ${owner}'s ${account} transactions between ${start_date} and ${end_date}`
  );
  try {
    getTransactionsFromRange(
      formatDate(start_date),
      formatDate(end_date),
      false,
      owner,
      account,
      "sandbox"
    );
  } catch (e) {
    console.log(e);
  }
};

/**
 * Primary function to grab data from the plaid API. Is able to grab >500 transactions.
 * @param {*} start_date
 * @param {*} end_date
 * @param {*} includeHeaders
 * @param {*} account
 */
const getTransactionsFromRange = (
  start_date,
  end_date,
  includeHeaders,
  owner,
  account,
  env
) => {
  console.log(
    `Running getTransactionsFromRange from ${start_date} to ${end_date} for ${owner}'s ${account} account`
  );
  try {
    const tokensProp = JSON.parse(
      PropertiesService.getScriptProperties().getProperty("tokens")
    );
    let ACCESS_TOKEN_EARLIEST_DATE = tokensProp[owner][account]["earliestDate"];
    ACCESS_TOKEN_EARLIEST_DATE = new Date(ACCESS_TOKEN_EARLIEST_DATE);
    // Since transaction IDs are only unique to an access token. This prevents an duplicate transactions in the case an access token is swapped out and then the date range is adjusted to before the date the access token was swapped.
    if (ACCESS_TOKEN_EARLIEST_DATE > start_date) {
      start_date = ACCESS_TOKEN_EARLIEST_DATE;
    }
    const ACCESS_TOKEN = tokensProp[owner][account]["token"];
    const CLIENT_ID =
      PropertiesService.getScriptProperties().getProperty("client_id");
    const SECRET =
      PropertiesService.getScriptProperties().getProperty("secret");
    const COUNT = 500;
    // headers are a parameter plaid requires for the post request
    // plaid takes a contentType parameter
    // google app script takes a content-type parameter
    var headers = {
      contentType: "application/json",
      "Content-Type": "application/json",
    };
    // data is a parameter plaid requires for the post request.
    // created via the plaid quickstart app (node)
    var data = {
      access_token: ACCESS_TOKEN,
      client_id: CLIENT_ID,
      secret: SECRET,
      start_date: start_date,
      end_date: end_date,
    };
    console.log("data", data);
    // pass in the necessary headers
    // pass the payload as a json object
    var parameters = {
      headers: headers,
      payload: JSON.stringify(data),
      method: "post",
      muteHttpExceptions: true,
    };
    // api host + endpoint
    var url = PropertiesService.getScriptProperties().getProperty(
      `${env}Endpoint`
    );
    var response = UrlFetchApp.fetch(url, parameters);
    console.log("response", response);
    response = JSON.parse(response);
    // parse the response into a JSON object
    let transactions = response.transactions;
    const total_transactions = response.total_transactions;

    // To pull more than 500 responses, the request parameters must be updated with each loop so a new options object can be passed in.
    const updateRequestParameters = (transactions) => {
      var data = {
        access_token: ACCESS_TOKEN,
        client_id: CLIENT_ID,
        secret: SECRET,
        start_date: start_date,
        end_date: end_date,
        options: {
          offset: transactions.length,
        },
      };

      var parameters = {
        headers: headers,
        payload: JSON.stringify(data),
        method: "post",
        muteHttpExceptions: true,
      };
      return parameters;
    };

    try {
      while (transactions.length < total_transactions) {
        let paginatedResponse = UrlFetchApp.fetch(
          url,
          updateRequestParameters(transactions)
        );
        paginatedResponse = JSON.parse(paginatedResponse);
        transactions = transactions.concat(paginatedResponse.transactions);
      }
    } catch (error) {
      // handle eror
      console.log(error);
    }

    const accounts = getAccountsMap(response.accounts);
    return {
      transactions,
      accounts,
    };
  } catch (e) {
    console.log(`${owner} transaction data was not added because:`, e.stack);
  }
};

// Returns 2D array for one owner's data
const runAccountBalancesEndpoint = (owner, account) => {
  const ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty(
    `${owner}_${account}_access_token`
  );
  const CLIENT_ID =
    PropertiesService.getScriptProperties().getProperty("client_id");
  const SECRET = PropertiesService.getScriptProperties().getProperty("secret");
  const COUNT = 30;
  // headers are a parameter plaid requires for the post request
  // plaid takes a contentType parameter
  // google app script takes a content-type parameter
  var headers = {
    contentType: "application/json",
    "Content-Type": "application/json",
  };
  // data is a parameter plaid requires for the post request.
  // created via the plaid quickstart app (node)
  var data = {
    access_token: ACCESS_TOKEN,
    client_id: CLIENT_ID,
    secret: SECRET,
  };
  // pass in the necessary headers
  // pass the payload as a json object
  var parameters = {
    headers: headers,
    payload: JSON.stringify(data),
    method: "post",
    muteHttpExceptions: true,
  };
  // api host + endpoint
  var url = "https://development.plaid.com/accounts/balance/get";
  try {
    var response = UrlFetchApp.fetch(url, parameters);
    response = JSON.parse(response);
    let accounts = response.accounts;
    let currentDate = new Date();
    currentDate = currentDate.toISOString().split("T")[0];
    let result = [];
    accounts.forEach((account) => {
      if (owner === "Ashley") {
        if (
          account.mask === "9661" ||
          account.mask === "5281" ||
          account.mask === "3829"
        ) {
          return;
        }
      }
      let arr = [
        currentDate,
        owner,
        account.account_id,
        account.mask,
        account.name,
        account.official_name,
        account.type,
        account.subtype,
        "USD", //currency
        account.balances.available,
        account.subtype === "credit card"
          ? account.balances.current * -1
          : account.balances.current,
        account.balances.limit,
      ];
      result.push(arr);
    });
    return result;
  } catch (e) {
    console.log(e);
    alertViaEmail(owner, account, "runAccountBalancesEndpoint", e);
  }
};

const accountBalances = (accounts, owner) => {
  try {
    let accountMasks = [];
    for (let account in accounts) {
      let mask = accounts[account].mask;
      accountMasks.push(mask);
    }
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    let accountBalancesSheet = ss.getSheetByName(accountBalancesSheetName);
    let accountBalancesData = accountBalancesSheet.getDataRange().getValues();
    // sort accountBalancesData by date
    accountBalancesData.sort((a, b) => {
      return new Date(b[0]) - new Date(a[0]);
    });

    // Get first occurence of each account in accountBalancesData
    let latestDateByMask = {};
    // get the latest date for each account
    accountBalancesData.forEach((row) => {
      let mask = row[3];
      let date = row[0];
      if (latestDateByMask[mask] === undefined) {
        latestDateByMask[mask] = date;
      } else {
        if (new Date(date) > new Date(latestDateByMask[mask])) {
          latestDateByMask[mask] = date;
        }
      }
    });
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    let result = [];
    for (let account in accounts) {
      let acc = accounts[account];
      if (latestDateByMask[acc.mask] === undefined) {
        console.log("no data for", acc.mask);
        continue;
      }

      if (latestDateByMask[acc.mask].getTime() === currentDate.getTime()) {
        console.log(
          `Account balances not retrieved for ${acc.mask} because the data has already been retrieved for ${currentDate}`
        );
      } else {
        let arr = [
          currentDate,
          owner,
          acc.account_id,
          acc.mask,
          acc.name,
          acc.official_name,
          acc.type,
          acc.subtype,
          "USD", //currency
          acc.balances.available,
          acc.subtype === "credit card"
            ? acc.balances.current * -1
            : acc.balances.current,
          acc.balances.limit,
        ];
        result.push(arr);
      }
    }
    writeDataToBottomOfTab(accountBalancesSheetName, result);
    if (result.length > 0) {
      console.log(`Account balances added for ${owner}`);
    }
  } catch (e) {
    console.log(e);
    alertViaEmail(
      owner,
      account,
      "getAccountBalancesFromTransactionEndpoint",
      e
    );
  }
};
