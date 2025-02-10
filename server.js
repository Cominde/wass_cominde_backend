const express = require("express");
const ApiError = require("./utils/apiError");
const globalError = require("./middlewares/errorMiddleware");
const mountRoutes=require("./routes/index");
require("dotenv").config();
const dotenv = require("dotenv");

dotenv.config({ path: "config.env" });
const dbConnection = require("./config/database");

dbConnection();

const app = express();
app.use(express.json());
mountRoutes(app);

app.all("*", (req, res, next) => {
  // const err =new Error(  `can't find this route ${req.originalUrl}`);
  // next(err.message);
  next(new ApiError(`Cant't find this route : ${req.originalUrl}`, 400));
});


app.use(globalError);

app.get("/", (req, res) => {
  res.send("our api v3");
});

const PORT = process.env.PORT;


const server = app.listen(PORT, () => {
  console.log(process.env.NODE_ENV);
  console.log("app running");
});

process.on("unhandledRejection", (err) => {
  console.error(`UnhandeldRejection Erros:${err.name}|${err.message}`);

  server.close(() => {
    console.error(`Shuting down ...`);
    process.exit(1);
  });
});
