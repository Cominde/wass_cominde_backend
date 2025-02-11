const fs = require('fs');
const path = require('path');

class MongoStore {
    constructor({ mongoose, path } = {}) {
        if (!mongoose) throw new Error('A valid Mongoose instance is required for MongoStore.');
        this.mongoose = mongoose;
        // Use /tmp directory for temporary storage
        this.path = path ?? './tmp/';
    }

    async sessionExists(options) {
        console.log(`database connected :${this.mongoose.connection.db}`);
        let multiDeviceCollection = this.mongoose.connection.db.collection(`whatsapp-${options.session}.files`);
        let hasExistingSession = await multiDeviceCollection.countDocuments();
        return !!hasExistingSession;
    }

    async save(options) {
        const filePath = path.join(this.path, `${options.session}.zip`);
        const bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });

        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(bucket.openUploadStream(`./tmp/${options.session}.zip`)) // Use only the filename
                .on('error', err => reject(err))
                .on('close', () => resolve());
        });

        options.bucket = bucket;
        await this.#deletePrevious(options);
    }

    async extract(options) {
        const filePath = path.join(this.path, options.path);
        const bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });

        return new Promise((resolve, reject) => {
            bucket.openDownloadStreamByName(`${options.session}.zip`) // Use only the filename
                .pipe(fs.createWriteStream(filePath))
                .on('error', err => reject(err))
                .on('close', () => resolve());
        });
    }

    async delete(options) {
        const bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });

        const documents = await bucket.find({
            filename: `${options.session}.zip` // Use only the filename
        }).toArray();

        documents.map(async doc => {
            return bucket.delete(doc._id);
        });
    }

    async #deletePrevious(options) {
        const documents = await options.bucket.find({
            filename: `${options.session}.zip` // Use only the filename
        }).toArray();

        if (documents.length > 1) {
            const oldSession = documents.reduce((a, b) => a.uploadDate < b.uploadDate ? a : b);
            return options.bucket.delete(oldSession._id);
        }
    }
}

module.exports = { MongoStore };