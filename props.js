const setProps = () => {
  var scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperties({
    client_id: "60df35af19a2660010f8b6e8",
    secret: "b9e93c1b33370097dbef1ae743fea6",
    // You can include multiple accounts here under the same client. Use this format per account. Owner name, then account name.
    // Owner: {
    //   Account: {
    //     token: "access-sandbox-e5ad8ed8-e0c6-4b67-8681-279c0cf172b4",
    //     earliestDate: "2019-07-29",
    //   },
    // },
    // Earliest date signified a hard stop of the earliest date to pull transactions.
    tokens: JSON.stringify({
      Sandbox: {
        Chase: {
          token: "access-sandbox-a5d8d600-bf08-4cea-814c-497563ecc9ba",
          // earliestDate: "2019-07-29",
        },
      },
    }),
    // This is where we define the sheet name to dump data to
    sheet: "Transactions",
    count: 500,
    developmentEndpoint: "https://development.plaid.com/transactions/get",
    sandboxEndpoint: "https://sandbox.plaid.com/transactions/get",
  });
};
