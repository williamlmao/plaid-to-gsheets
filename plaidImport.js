// Import all new transactions & account balances. Excludes pending transactions. Running.
const importLatest = () => {
  const start_date = formatDate(getStartDate());
  const end_date = formatDate(new Date());
  const data = importTransactionsAndAccountBalances(start_date, end_date);
  writeDataToBottomOfTab(
    runningTransactionsSheetName,
    data.transactions,
    false
  );
  writeDataToBottomOfTab(accountBalancesSheetName, data.accountBalances, false);
};

const importByDateRange = () => {
  const importSettings = ss.getSheetByName(importSettingsSheetName);
  const startDate = formatDate(importSettings.getRange("B3").getValue());
  const endDate = formatDate(importSettings.getRange("B4").getValue());
  const data = importTransactionsAndAccountBalances(start_date, end_date);
  writeDataToBottomOfTab(runningTransactionsSheetName, data.transactions, true);
  writeDataToBottomOfTab(accountBalancesSheetName, data.accountBalances, false);
};

const importTransactionsAndAccountBalances = (start_date, end_date) => {
  let transactions = [];
  let accountBalances = [];
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
        owner,
        account
      );
      let transformedTransactions = transformTransactions(
        cleanedTransactions,
        true
      );
      transactions = transactions.concat(transformedTransactions);
      accountBalances = accountBalances.concat(
        getAccountBalances(response.accounts, owner)
      );
    }
  }
  return { transactions, accountBalances };
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
 *
 * @param {Array} accountBalances array of objects from the transactions endpoint
 * @param {string} owner
 */
const getAccountBalances = (accountBalances, owner) => {
  try {
    let lastAccountBalanceDatesObj = getLastAccountBalanceDateByMask();
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    let result = [];
    accountBalances.forEach((account) => {
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

      if (lastAccountBalanceDatesObj[account.mask]) {
        if (
          lastAccountBalanceDatesObj[account.mask].getTime() ===
          currentDate.getTime()
        ) {
          return;
        } else {
          result.push(arr);
        }
      } else {
        result.push(arr);
      }
    });
    return result;
  } catch (e) {
    console.log(e);
  }
};

/**
 *
 * @returns An object containing the most recent date for each account in the account balances sheet
 */
const getLastAccountBalanceDateByMask = () => {
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
    let mask = row[accountBalancesMaskColumnNumber];
    let date = row[accountBalancesDateColumnNumber];
    if (mask) {
      if (latestDateByMask[mask] === undefined) {
        latestDateByMask[mask] = date;
      } else {
        if (new Date(date) > new Date(latestDateByMask[mask])) {
          latestDateByMask[mask] = date;
        }
      }
    }
  });
  return latestDateByMask;
};
