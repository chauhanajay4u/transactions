const express = require("express")
const auth = require("../middleware/auth")
const { dbQuery } = require("../common/utils")
const router = new express.Router()

router.post("/user/login", async (req, res) => {
    const email = req.body.email
    const password = req.body.password
    if (!(email && password)) res.status(401).send("Please provide Email and Password")
    let results = await dbQuery(
        `SELECT * FROM users WHERE email='${email}' AND password='${password}';`
    )
    if (!results.length) res.status(404).send({ error: "Unauthorized" })
    user = results[0]
    data = {
        userId: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
    }
    res.send(data)
})

router.get("/user/:userId/profile", auth("userId"), async (req, res) => {
    data = {
        userId: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone
    }
    res.send(data)
})

router.post("/user/:userId/profile-update", auth("userId"), async (req, res) => {
    try {
        query = `UPDATE users SET name='${req.body.name}', email='${req.body.email}', phone='${req.body.phone}' WHERE id=${req.user.id};`
        await dbQuery(query)
        data = req.body
        data.userId = req.user.id
        res.send(req.body)
    } catch (e) {
        res.status(400).send("Update Failed")
    }
})

router.post("/user/:userId/get-total-amount", auth("userId"), async (req, res) => {
    const fromDate = req.body.fromDate
    const toDate = req.body.toDate
    if (!(fromDate && toDate)) res.status(400).send("Please provide Date Range")
    results = await dbQuery(
        `select sum(case when sender_id = ${req.user.id} then amount else null end) as amount_sent, sum(case when receiver_id = ${req.user.id} then amount else null end) as amount_received from transactions where sender_id = ${req.user.id} or receiver_id = ${req.user.id} and date(transaction_date) >= '${fromDate}' and date(transaction_date) <= '${toDate}';`
    )
    if (!results.length) res.send("No Data Found")
    data = results[0]
    res.send(data)
})

router.post("/user/:userId/transactions", auth("userId"), async (req, res) => {
    const fromDate = req.body.fromDate
    const toDate = req.body.toDate
    const receiverName = req.query.receiverName ? req.query.receiverName : ""
    const receiverEmail = req.query.receiverEmail ? req.query.receiverEmail : ""
    const receiverPhone = req.query.receiverPhone ? req.query.receiverPhone : ""
    if (!(fromDate && toDate)) res.status(400).send("Please provide Date Range")
    query = `SELECT a.transaction_id, IF(a.type = 'debit', receiver.id, sender.id) AS account_id, IF(a.type = 'debit', receiver.name, sender.name) AS name, a.type, a.amount, a.transaction_date, a.transaction_type AS mode FROM (SELECT transactions.id AS transaction_id, transactions.amount, transactions.transaction_date, transactions.transaction_type, transactions.sender_id, transactions.receiver_id, IF(transactions.sender_id = ${req.user.id}, 'debit', 'credit') AS type FROM transactions WHERE (transactions.sender_id = ${req.user.id} OR transactions.receiver_id = ${req.user.id})) a, users sender, users receiver WHERE a.sender_id = sender.id AND a.receiver_id = receiver.id AND receiver.name LIKE "%${receiverName}%" AND receiver.email LIKE "%${receiverEmail}%" AND receiver.phone LIKE "%${receiverPhone}%" AND DATE(transaction_date) >= '${fromDate}' AND DATE(transaction_date) <= '${toDate}' ORDER BY transaction_date DESC;`
    results = await dbQuery(query)
    if (!results.length) res.send("No Data Found")
    data = results
    res.send(data)
})

router.get("/get-best-users", async (req, res) => {
    results = await dbQuery(
        `SELECT u.name, SUM(t.amount) AS total_transactions_amount FROM users u LEFT JOIN transactions t ON (u.id = t.sender_id OR u.id = t.receiver_id) group by u.id ORDER BY SUM(t.amount) DESC LIMIT 3;`
    )
    res.send(results)
})

router.post("/user/:userId/amount-per-month", auth("userId"), async (req, res) => {
    const month = req.body.month
    if (!month) res.status(400).send("Please provide Month")
    results = await dbQuery(
        `select sum(case when t.sender_id = ${req.user.id} then t.amount else null end) as total_amount_sent, sum(case when t.receiver_id = ${req.user.id} then t.amount else null end) as total_amount_received, avg(case when t.sender_id = ${req.user.id} then t.amount else null end) as average_amount_sent, avg(case when t.receiver_id = ${req.user.id} then t.amount else null end) as average_amount_received from transactions t where t.sender_id = ${req.user.id} or t.receiver_id = ${req.user.id} and month(t.transaction_date) = ${month};`
    )
    if (!results.length) res.send("No Data Found")
    data = results[0]
    res.send(data)
})

router.post("/max-amount-for-month", async (req, res) => {
    const month = req.body.month
    if (!month) res.status(400).send("Please provide Month")
    results = await dbQuery(
        `select t.id as transaction_id, s.name as sender, r.name as receiver, t.amount, t.transaction_date, t.transaction_type from transactions t, users s, users r where t.sender_id = s.id and t.receiver_id = r.id and amount = (select max(amount) from transactions where month(transaction_date) = ${month});`
    )
    if (!results.length) res.send("No Data Found")
    res.send(results)
})

module.exports = router
