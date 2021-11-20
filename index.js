const express=require('express');
const app=express();
const cors=require('cors');
require('dotenv').config()
const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");


const port=process.env.PORT || 5000;



const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors());
app.use(express.json());

// doctors-eportal-firebase-adminsdk

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jgurp.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req,res,next){
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const token=req.headers.authorization.split(' ')[1];

        try {
            const decodedUser =await admin.auth().verifyIdToken(token);
            req.decodedEmail=decodedUser.email;
            
        } catch (error) {
            
        }
    }
    next()
}

async function run() {
    try {
        await client.connect();
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        app.get('/appointments',verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();

            const query = { email: email, date: date }

            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment);
            console.log(result);
            res.json(result)
        });

        // users api post
        app.post('/users',async(req,res)=>{
            const user=req.body;
            const result=await usersCollection.insertOne(user);
            res.json(result);
        });

        // users api post
        app.get('/users',async(req,res)=>{
            const users=usersCollection.find({});
            const result=await users.toArray();
            res.send(result);
        });

        //users post
        app.put('/users',async(req,res)=>{
            
            const user=req.body;
            console.log(user);
            const filter = { email: user.email };
            const options = { upsert: true };
           
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);

            res.json(result);
        });

        // make user admin
        app.put('/users/admin',verifyToken,async(req,res)=>{
            const user=req.body;
            const requester=req.decodedEmail;
            if(requester){
                const requesterAccout=await usersCollection.findOne({email: requester});
                if(requesterAccout.role === 'admin'){

                    const filter={email: user.email};
                    const updateDoc={$set:{role:"admin"}};
                    const result=await usersCollection.updateOne(filter,updateDoc);
                    res.json(result);

                }
            }
            else{
                res.status(403).json({message: 'You do not have access to make admin'});
            }
                   
        });
        //check user admin
        app.get('/users/:email',async(req,res)=>{
        
            const email=req.params.email;
            const query={email: email};
            const user=await usersCollection.findOne(query);
            let isAdmin= false;
            if(user?.role ==='admin'){
                isAdmin=true;
            }
            res.send({admin: isAdmin});
        });



        // payment 
        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            });
            console.log(paymentIntent);
            res.json({ clientSecret: paymentIntent.client_secret });
        
        })



    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);



app.get('/',(req,res)=>{
    res.send('connect to server');
});

app.listen(port,(req,res)=>{
    console.log('connect to port:',port);
})
