const express = require('express');


const{
    protect,
    allowedTo,
}=require('../services/authServices');

const {
    addQuota,
    generateKey,
    getUserKeys,
    changeKeyActivationState,
    changeKeyLimitState,
    setKeyLimit,
    getUserActivities,
}= require('../services/userServices');


const router = express.Router();

router.route('/add-quota/:id').post(protect,allowedTo('admin'),addQuota);
router.route('/genrate-key').get(protect,generateKey);
router.route('/getUserKeys').get(protect,getUserKeys);

router.route('/changeKeyActivationState/:keyId').put(protect,changeKeyActivationState);
router.route('/changeKeyLimitState/:keyId').put(protect,changeKeyLimitState);

router.route('/setKeyLimit/:keyId').put(protect,setKeyLimit);

router.route('/getUserActivities').get(protect,getUserActivities);

module.exports=router;
