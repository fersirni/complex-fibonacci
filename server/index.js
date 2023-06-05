const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const redis = require('redis');
const keys = require('./keys');
const pg = require('pg');

const app = express();

app.use(cors());
app.use(bodyParser.json());

const { Pool } = pg;

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});

pgClient.on("connect", (client) => {
  client
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch(err => console.log(err));
});

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

redisClient.on("error", (err) => {
  console.log("Error " + err);
});

redisClient.on("connect", (client) => {
  console.log("Redis connected");
});

const redisPublisher = redisClient.duplicate();

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');
  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const { index } = req.body;
  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }
  redisClient.hset('values', index, 'Nothing yet!');
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
  res.send({ working: true });
});

app.listen(5000, err => {
  console.log('Listening');
});