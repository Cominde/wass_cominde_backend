const User = require("../models/userModel");
const Key=require("../models/keyModel");
const ApiError = require("../utils/apiError");

exports.addQuota=async (req,res,next)=>{
    try{
        // Check if user exists
        const user = await User.findById(req.params.id);
        if (!user) {
            throw new ApiError("User not found");
        }
        // Add quota
        const expiryDate = new Date(req.body.expiresAt.split('/').reverse().join('/'));
        expiryDate.setHours(0, 0, 0, 0);
        user.quota.push({
            amount: req.body.amount,
            expiresAt: expiryDate
        });
        user.activities.push({
            action: `Added ${req.body.amount} quota`,
        });
        await user.save();
        res.status(200).json({
            status: 'success',
            data: user
        });
    }
    catch(error){
        next(error);
    }
};


exports.generateKey=async(req, res, next)=>{
    try{

        // Check if user exists
      const key= await Key.create({
        userId:req.user._id,
        });

        User.findById(req.user._id).then((user)=>{
            user.keys.push(key._id);
            user.activities.push({
                action: `Generated new key for ${user.name}`,
            });
            user.save();
            res.status(200).json({
                status:'success',
                data:user
            });
        });
    }
    catch(error){
        next(error);
    }
}

exports.getUserKeys = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'keys',
            model: 'Key'
        });
        
        res.status(200).json({
            status: 'success',
            keys: user.keys
        });
    } catch(error) {
        next(error);
    }
};

exports.getUserActivities = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        const activities = req.user.activities;
        const paginatedActivities = activities.slice(startIndex, endIndex);
        
        res.status(200).json({
            status: 'success',
            page,
            limit,
            totalPages: Math.ceil(activities.length / limit),
            totalActivities: activities.length,
            data: paginatedActivities
        });
    } catch(error) {
        next(error);
    }
};

exports.changeKeyActivationState=async(req, res, next)=>{
    try{


        const key= await Key.findById(String(req.params.keyId));
        if(!key){
            throw new ApiError("Key not found");
        }
        if (!req.user.keys.includes(key._id)) {
            throw new ApiError("This key does not belong to the user");
        }
        key.isActive = !key.isActive;
        await key.save();

         req.user.activities.push({
            action: `change key: ${key.key} state to ${key.isActive ? 'active' : 'not active'}`,
        });
        req.user.save();
        res.status(200).json({
            status:'success',
            data:key
        });

    }catch(error){
        next(error);
    };
}
exports.changeKeyLimitState=async(req, res, next)=>{
    try{


        const key= await Key.findById(String(req.params.keyId));
        if(!key){
            throw new ApiError("Key not found");
        }
        if (!req.user.keys.includes(key._id)) {
            throw new ApiError("This key does not belong to the user");
        }
        key.useLimit = !key.useLimit ;
        await key.save();

         req.user.activities.push({
            action: `change key: ${key.key} limit to ${key.useLimit ? 'active' : 'not active'}`,
        });
        req.user.save();
        res.status(200).json({
            status:'success',
            data:key
        });

    }catch(error){
        next(error);
    };
}

exports.setKeyLimit=async(req, res, next)=>{
    try{


        const key= await Key.findById(String(req.params.keyId));
        if(!key){
            throw new ApiError("Key not found");
        }
        if (!req.user.keys.includes(key._id)) {
            throw new ApiError("This key does not belong to the user");
        }
        const quotaLimit=req.body.quotaLimit;
        

        if (!quotaLimit ) {
            throw new ApiError("Please provide a quota limit");
        }


        key.quotaLimit = quotaLimit;
        await key.save();

         req.user.activities.push({
            action: `set key: ${key.key} limit to ${key.quotaLimit}`,
        });
        req.user.save();
        res.status(200).json({
            status:'success',
            data:key
        });

    }catch(error){
        next(error);
    };
}

