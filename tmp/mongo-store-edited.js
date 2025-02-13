const fs = require('fs');
const path = require('path');

class MongoStore {
    constructor({ mongoose, path } = {}) {
        if (!mongoose) throw new Error('A valid Mongoose instance is required for MongoStore.');
        this.mongoose = mongoose;
        // Use /tmp directory for temporary storage
        this.path = path ?? ''; // ./tmp/
    }

    async sessionExists(options) {
        console.log(`strart sessionExists`);
        let multiDeviceCollection = this.mongoose.connection.db.collection(`whatsapp-${options.session}.files`);
        //console.log(multiDeviceCollection);
        let hasExistingSession = await multiDeviceCollection.countDocuments();
        console.log(`end sessionExists`);
        return !!hasExistingSession;
    }

    async save(options) {
        console.log(`strart save`);
        const filePath = path.join(this.path, `${options.session}.zip`);
        const bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });

        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(bucket.openUploadStream(`${options.session}.zip`)) // Use only the filename
                .on('error', err => reject(err))
                .on('close', () => resolve());
        });

        options.bucket = bucket;
        await this.#deletePrevious(options);
        console.log(`end save`);
    }

    async extract(options) {
        console.log(`strart extract`);
        const bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });
        console.log(`end extract`);

        return new Promise((resolve, reject) => {
            //console.log(process.cwd())
            bucket.openDownloadStreamByName(`${options.session}.zip`)
                .pipe(fs.createWriteStream(`${this.path}${options.session}.zip`))
                .on('error', err => reject(err))
                .on('close', () => resolve());
        });
    }

    async delete(options) {
        console.log(`strart delete`);
        const bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });

        const documents = await bucket.find({
            filename: `${options.session}.zip` // Use only the filename
        }).toArray();

        console.log(`end delete`);

        documents.map(async doc => {
            return bucket.delete(doc._id);
        });
    }

    async #deletePrevious(options) {
        console.log(`strart deletePrevious`);
        const documents = await options.bucket.find({
            filename: `${options.session}.zip` // Use only the filename
        }).toArray();

        console.log(`end deletePrevious`);

        if (documents.length > 1) {
            const oldSession = documents.reduce((a, b) => a.uploadDate < b.uploadDate ? a : b);
            return options.bucket.delete(oldSession._id);
        }
    }
}

module.exports = { MongoStore };