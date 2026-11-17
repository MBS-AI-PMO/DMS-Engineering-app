const { Pool, types, defaults } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// The database clock is UTC and `timestamp without time zone` columns hold
// UTC wall time (NOW() defaults). pg would read them as the server's local
// time (5 hours off in Pakistan), so read them as UTC, and send JS dates as
// UTC so anything written from code matches.
const TIMESTAMP_WITHOUT_TZ = 1114;
types.setTypeParser(TIMESTAMP_WITHOUT_TZ, (value) => (value === null ? null : new Date(`${value.replace(' ', 'T')}Z`)));
defaults.parseInputDatesAsUTC = true;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // Notice we completely removed the SSL configuration here
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};