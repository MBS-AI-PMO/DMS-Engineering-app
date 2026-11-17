/*
 * Shared backend helpers. Routes should build on these rather than repeat
 * try/catch, validation and file handling:
 *
 *   http.js      route(label, fn), ok/created, HttpError + badRequest/notFound/…, one(result)
 *   validate.js  text, number, integer, id, bool, oneOf, email, url, day, json, list
 *   files.js     resolveUpload, publicUrl, removeUpload, imageUpload + handleUpload, saveImage
 *   db.js        withTransaction, readSetting, writeSetting
 */
module.exports = {
    ...require('./http'),
    validate: require('./validate'),
    ...require('./files'),
    ...require('./db'),
};
