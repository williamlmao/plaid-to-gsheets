// Import all new transactions & account balances. Excludes pending transactions. Running.
const importLatest = () => {
  const runningTransactionsSheet = ss.getSheetByName(
    runningTransactionsSheetName
  );
  const headersPresent =
    runningTransactionsSheet.getRange("A1").getValue() === transactionHeaders[0]
      ? true
      : false;
  const start_date = formatDate(getStartDate());
  const end_date = formatDate(new Date());
  const data = importTransactionsAndAccountBalances(start_date, end_date, true);
  if (!headersPresent) {
    data.transactions.unshift(transactionHeaders);
  }

  writeDataToBottomOfTab(
    runningTransactionsSheetName,
    data.transactions,
    false
  );
  writeDataToBottomOfTab(accountBalancesSheetName, data.accountBalances, false);
  cleanup(runningTransactionsSheetName, transactionsDateColumnNumber);
  cleanup(accountBalancesSheetName, accountBalancesDateColumnNumber);
};

/**
 * Uses the dates in the "Import settings" sheet to determine the date range to pull from. plaid API can only get the last 2 years of data.
 */
const importByDateRange = () => {
  const importSettings = ss.getSheetByName(importSettingsSheetName);
  const start_date = formatDate(importSettings.getRange("B3").getValue());
  const end_date = formatDate(importSettings.getRange("B4").getValue());
  if (!start_date || !end_date) {
    ui.alert(
      'Please enter a valid start and end date in the "Import settings" sheet.'
    );
    return;
  }
  const data = importTransactionsAndAccountBalances(
    start_date,
    end_date,
    false
  );
  writeDataToBottomOfTab(
    dateRangeTransactionsSheetName,
    data.transactions,
    true
  );
  writeDataToBottomOfTab(accountBalancesSheetName, data.accountBalances, false);
  cleanup(accountBalancesSheetName, accountBalancesDateColumnNumber);
};

const importTransactionsAndAccountBalances = (
  start_date,
  end_date,
  filterForTransactionIds
) => {
  let transactions = [];
  let accountBalances = [];
  // For each access token, get all transactions and account balances. Normalize the data.
  for (let owner in tokens) {
    for (let account in tokens[owner]) {
      const access_token = tokens[owner][account]["token"];
      const access_token_earliest_date = tokens[owner][account]["earliestDate"]
        ? tokens[owner][account]["earliestDate"]
        : undefined;
      let response = hitPlaidTransactionsEndpoint(
        start_date,
        end_date,
        owner,
        account,
        access_token,
        access_token_earliest_date,
        environment
      );

      let cleanedTransactions = cleanTransactions(
        response.transactions,
        getAccountsMap(response.accounts),
        owner,
        account,
        filterForTransactionIds
      );

      let transformedTransactions = transformTransactions(cleanedTransactions);

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
  access_token,
  access_token_earliest_date,
  env
) => {
  console.log(
    `Running getTransactionsFromRange from ${start_date} to ${end_date} for ${owner}'s ${account} account`
  );
  const url = `https://${
    env == "sandbox" ? "sandbox" : "development"
  }.plaid.com/transactions/get`;
  try {
    // Since transaction IDs are only unique to an access token. This prevents an duplicate transactions in the case an access token is swapped out and then the date range is adjusted to before the date the access token was swapped.
    if (access_token_earliest_date > start_date) {
      start_date = access_token_earliest_date;
    }

    // headers are a parameter plaid requires for the post request
    var headers = {
      contentType: "application/json",
      "Content-Type": "application/json",
    };
    // data is a parameter plaid requires for the post request.
    var data = {
      access_token: access_token,
      client_id: client_id,
      secret: secret,
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
        access_token: access_token,
        client_id: client_id,
        secret: secret,
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
    let accountBalancesSheet = ss.getSheetByName(accountBalancesSheetName);
    let headersPresent =
      accountBalancesSheet.getRange("A1").getValue() ===
      accountBalanceHeaders[0]
        ? true
        : false;
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
    if (!headersPresent) {
      result.unshift(accountBalanceHeaders);
    }
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
