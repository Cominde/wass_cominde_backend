
const authRoute= require('./authRoute');
const userRoute= require('./userRoute');
const messagingRoute= require('./messagingRoute');

const mountRoutes = (app)=>{
    app.use("/api/v1/auth", authRoute);
    app.use("/api/v1/user", userRoute);
    app.use("/api/v1/messaging", messagingRoute);
}

module.exports=mountRoutes;