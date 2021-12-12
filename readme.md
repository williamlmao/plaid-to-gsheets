# Overview

I tried out some of the personal finance apps like Mint and Personal Capital. They were great, but I'm picky with the way I do manage my finances and I would get frustrated with not being able to get everything exactly the way I like it. I also didn't like the idea of my financial data being sold to advertisers. So I decided that I had to build my own solution. This system uses Plaid ([they do not sell data to advertisers](https://news.ycombinator.com/item?id=18655417)), Google Sheets, and Data Studio. You'll need a Plaid Developer account and a Google account.

# Features

- Automatically import transaction and account balance data from any account available in Plaid (Import Latest Transactions)
- Import plaid API data between a specific date range (Import Date Range)
- Easily import reports from other accounts that are not available in Plaid (Import Other Accounts)
- Build rules to transform imported transactions

# Getting Started

## Get your access_tokens

1. You'll first need to create a Plaid Developer Account. Don't worry that you aren't creating real fintech app with this account, even the Plaid founder [has said he's used this method to pull data into Google Sheets for his personal projects](https://stackoverflow.com/questions/49868037/integrating-plaid-and-google-apps-script).
2. Once you have that account set up, you'll need to boot up the Plaid Quickstart app on your machine. You can find those instructions [here](https://plaid.com/docs/quickstart/).
3. Boot up Quickstart and then use Plaid Link to connect to one of your bank accounts. Once you're connected, the Quickstart app will show your access_token.

## Set up the Google Sheet

1. Copy [this google sheet](https://docs.google.com/spreadsheets/d/1d60g7UmSDV08VCtZAY5csPhTiRg6J1AdVuNEFb3993g/edit#gid=340231135).
2. In the sheets menu, go to Extensions -> Apps Script
3. In the Apps Script editor, go to `props.gs`

- Set the client ID, secret, and access tokens for various accounts in the props file.

# Ingesting data outside of the Plaid API

You can easily ingest other credit card reports that are not accessible via Plaid's API. The example sheet contains an example using an Apple Card report.

Instructions:

1. Create a new tab with the tab name in the following syntax: "Ingest Account Name", replacing "Account Name" with your account.
2. Go to the Account Header Map tab and add in a new row. In column A, make sure to put the same "Account Name" you used for the tab name. The program will match this data based on that string, so make sure its an exact match.
3. The top row in the Account Header Map tab is the schema used in the Transactions (Running) tab. Match each header in the report you are importing to one of these headers. It's likely that there are more columns in the Transactions (Running) tab than the report you're ingesting. Instead of matching a header in your report, you can put a default value instead.

Ingest rules will still be applied to this data, but you'll use the respective Transaction header instead of the report you are importing. For example, if Apple Card uses "Description" instead of "Name", you'll still use something like: If "Name" contains "McDonalds", transform "Category" to "Fast Food"

# Connecting to Data Studio

# Setting up automated imports using triggers

# Editing the schema

# Applying Transformation Rules

Transformation rules are applied automatically

# FAQ

#### What is "Rollup" column?

It makes it easier to aggregate data for some charts in data studio.
