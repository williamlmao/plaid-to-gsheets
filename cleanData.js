const operators = {
  equals: (a, b) => a === b,
  contains: (a, b) => a.indexOf(b) > -1,
  startsWith: (a, b) => a.indexOf(b) === 0,
  endsWith: (a, b) => a.indexOf(b) === a.length - b.length,
  greaterThan: (a, b) => a > b,
  lessThan: (a, b) => a < b,
  greaterThanOrEqual: (a, b) => a >= b,
  lessThanOrEqual: (a, b) => a <= b,
  notEqual: (a, b) => a !== b,
  notContains: (a, b) => a.indexOf(b) === -1,
  notStartsWith: (a, b) => a.indexOf(b) !== 0,
  notEndsWith: (a, b) => a.indexOf(b) !== a.length - b.length,
  notGreaterThan: (a, b) => a <= b,
  notLessThan: (a, b) => a >= b,
  notGreaterThanOrEqual: (a, b) => a < b,
  //regex match
  regexMatch: (a, b) => {
    const regex = new RegExp(b);
    return regex.test(a);
  },
};

// Function that takes an array of rules and returns a function
const buildRule = (rule) => {
  const column1 = rule["Column 1"];
  const operator1 = rule["Operator 1"];
  const value1 = rule["Value 1"];
  const column2 = rule["Column 2"];
  const operator2 = rule["Operator 2"];
  const value2 = rule["Value 2"];
  const column3 = rule["Column 3"];
  const operator3 = rule["Operator 3"];
  const value3 = rule["Value 3"];
  const andOr = rule["AND/OR"];
  const transformColumn1 = rule["Transform Column 1"];
  const transformValue1 = rule["Transform Value 1"];
  const transformColumn2 = rule["Transform Column 2"];
  const transformValue2 = rule["Transform Value 2"];
  const transformColumn3 = rule["Transform Column 3"];
  const transformValue3 = rule["Transform Value 3"];

  // Rule function also transforms the transaction if the rule is true
  const ruleFunction = (transaction) => {
    if (!operator1) {
      // ui alert if no operator is selected
      if (operator1 === "") {
        ui.alert("Please select an operator for column 1");
      } else {
        ui.alert(`${operator1} is not a valid operator`);
      }
    }

    const test = operators[operator1](transaction[column1], value1);
    if (operator2) {
      const test2 = operators[operator2](transaction[column2], value2);
      if (operator3) {
        const test3 = operators[operator3](transaction[column3], value3);
        if (andOr === "AND") {
          return test && test2 && test3;
        } else {
          return test || test2 || test3;
        }
      } else {
        if (andOr === "AND") {
          return test && test2;
        } else {
          return test || test2;
        }
      }
    } else {
      return test;
    }
  };

  // Transform the transaction if ruleFunction is true
  const transformTransaction = (transaction) => {
    if (ruleFunction(transaction)) {
      if (transformColumn1) {
        transaction[transformColumn1] = transformValue1;
      }
      if (transformColumn2) {
        transaction[transformColumn2] = transformValue2;
      }
      if (transformColumn3) {
        transaction[transformColumn3] = transformValue3;
      }
    }
    return transaction;
  };

  return transformTransaction;
};

// Create a function that takes an array of rules and returns a function that takes a transaction and returns true or false
const buildRuleApplicationAlgo = (rules) => {
  const ruleFunctions = rules.map(buildRule);
  const cleaningAlgorithm = (transaction) => {
    let result = true;
    ruleFunctions.forEach((ruleFunction) => {
      result = result && ruleFunction(transaction);
    });
    return result;
  };
  return cleaningAlgorithm;
};

/**
 *
 * @returns An new version of transactions object with the rules applied
 */
const applyRulesToTransactions = (rulesData, transactionsData) => {
  const ruleApplicationAlgorithm = buildRuleApplicationAlgo(rulesData);
  const ruledTransactions = (transactions) => {
    return transactions.map(ruleApplicationAlgorithm);
  };
  return ruledTransactions(transactionsData);
};

const cleanTransactionsFromSheet = () => {
  const transactionsData = getJsonArrayFromData(
    ss.getSheetByName("Transactions").getDataRange().getValues()
  );

  const rulesData = getJsonArrayFromData(
    ss.getSheetByName("Rules").getDataRange().getValues()
  );
  console.log("rulesData", rulesData);
  const ruledTransactions = applyRulesToTransactions(
    rulesData,
    transactionsData
  );
  console.log("ruledTransactions", ruledTransactions);
  const cleanedTransactions = ruledTransactions.map((transaction) =>
    Object.keys(transaction).map((key) => transaction[key])
  );
  console.log("cleanedTransactions", cleanedTransactions);
  writeDataToBottomOfTab("Cleaned Transactions", cleanedTransactions);
};
