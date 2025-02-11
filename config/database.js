const mongoose =require ('mongoose');


const dbConnection = () =>{
    
mongoose.connect(process.env.MONGO_URL).then((conn)=>{
    console.log(`database connected :${conn.connection.host}`)
    
    }).catch((error)=>{
        console.error(`database error: ${error}`);
        process.exit(1);
    });
    

    
    
}

module.exports=dbConnection;
