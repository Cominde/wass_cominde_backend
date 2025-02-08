const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const keySchema = new Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: () => Math.random().toString(36).substring(2) + Date.now().toString(36)
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    quotaLimit: {
        type: Number,
        required: true,
        default: 0
        
    },
    usedQuota: {
        type: Number,
        required: true,
        default: 0
    },
    useLimit:{
        type:Boolean,
        default:false,
    },
    isActive:{
        type:Boolean,
        default:true,
    }

});

module.exports = mongoose.model('Key', keySchema);