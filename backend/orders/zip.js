/*
 * A small ZIP writer (deflate, UTF-8 names, no ZIP64) for "download all
 * files" on an order. Each file is read and compressed in turn and written
 * straight to the response, so only one file is in memory at a time.
 */
const fs = require('fs');
const zlib = require('zlib');

function dosTime(date) {
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    return {
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
        date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
}

/* entries: [{ name: 'folder/file.step', path: '/abs/path' }] */
async function streamZip(res, entries) {
    const central = [];
    let offset = 0;
    const write = async (buf) => {
        if (res.destroyed) throw new Error('download cancelled');
        offset += buf.length;
        if (res.write(buf)) return;
        await new Promise(resolve => {
            const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
            res.on('drain', done);
            res.on('close', done);
        });
    };

    for (const entry of entries) {
        const data = await fs.promises.readFile(entry.path);
        const stat = await fs.promises.stat(entry.path);
        const packed = zlib.deflateRawSync(data, { level: 6 });
        const name = Buffer.from(entry.name, 'utf8');
        const crc = zlib.crc32(data) >>> 0;
        const { time, date } = dosTime(stat.mtime);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 names
        local.writeUInt16LE(8, 8); // deflate
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);

        const header = Buffer.alloc(46);
        header.writeUInt32LE(0x02014b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(20, 6);
        header.writeUInt16LE(0x0800, 8);
        header.writeUInt16LE(8, 10);
        header.writeUInt16LE(time, 12);
        header.writeUInt16LE(date, 14);
        header.writeUInt32LE(crc, 16);
        header.writeUInt32LE(packed.length, 20);
        header.writeUInt32LE(data.length, 24);
        header.writeUInt16LE(name.length, 28);
        header.writeUInt32LE(offset, 42); // where this file's local header starts
        central.push(Buffer.concat([header, name]));

        await write(Buffer.concat([local, name]));
        await write(packed);
    }

    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length, 8);
    end.writeUInt16LE(central.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    await write(directory);
    await write(end);
    res.end();
}

module.exports = { streamZip };
