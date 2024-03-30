/*
This file is used to delete an expense in dynamo db table for the user who is logged in.
*/

const { DeleteCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { dynamoDocClient } = require("../../lib/dynamoDB");
const { sendHTTPResponse } = require("../../lib/api");
const httpJsonBodyParser = require("@middy/http-json-body-parser");
const jwt = require("jsonwebtoken");
const middy = require("@middy/core");
const { getSecretKey } = require("../../lib/secretManager");

const handler = async (event) => {
    try {
        const { expenseId } = event.body;

        const token = event.headers.authorization.split('Bearer ')[1];

        // get SECRET_KEY from AWS Secrets Manager

        const JWT_SECRET = await getSecretKey();

        console.log("JWT_SECRET: ");
        console.log(JWT_SECRET);

        try {
            jwt.verify(token, JWT_SECRET);
        }
        catch (error) {
            return sendHTTPResponse(401, { error: "Unauthorized user" });
        }

        const decodedToken = jwt.decode(token);

        const deleteExpenseCommand = new DeleteCommand({
            TableName: "expenses",
            Key: {
                expenseId
            }
        });
        await dynamoDocClient.send(deleteExpenseCommand);

        // Get all expenses for the user using Scan Command

        const scanExpensesCommand = new ScanCommand({
            TableName: "expenses",
            FilterExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":userId": decodedToken.id
            }
        });

        const expenses = await dynamoDocClient.send(scanExpensesCommand);

        // Get balance for the user

        let balance = 0;

        expenses.Items.forEach(expense => {
            if (expense.category === "income") {
                balance += expense.amount;
            }
            else {
                balance -= expense.amount;
            }
        });

        return sendHTTPResponse(200, { message: "Expense deleted successfully", expenses: expenses.Items, balance: balance });

    }
    catch (error) {
        console.log(error);
        return sendHTTPResponse(500, { error: "An error occurred during expense deletion." });
    }
}

// @ts-ignore
module.exports = { handler: middy(handler).use(httpJsonBodyParser()) };