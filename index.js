const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://dbuser1:${process.env.DB_PASSWORD}@cluster0.3m6n3pz.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next()
    })
}

async function run() {
    try {
        const categoriesCollection = client.db('CarX').collection('Categories');
        const productsCollection = client.db('CarX').collection('Products');
        const usersCollection = client.db('CarX').collection('Users');
        const bookedCollection = client.db('CarX').collection('BookedProducts');
        const wishlistCollection = client.db('CarX').collection('wishlistProducts');

        app.get('/categories', async (req, res) => {
            const query = {};
            const result = await categoriesCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await categoriesCollection.findOne(query);
            res.send(result)
        })

        app.get('/myorders/:id', async (req, res) => {
            const uid = req.params.id;
            const query = { bookedById: uid };
            const result = await bookedCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/orders/:orderId', async (req, res) => {
            const id = req.params.orderId;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.findOne(query);
            res.send(result)
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { category: id }
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/my-products/:email', async (req, res) => {
            const email = req.params.email;
            const query = { sellerEmail: email };
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/ads', async (req, res) => {
            const query = { advertise: true }
            const filter = { timestamp: -1 }
            const result = await productsCollection.find(query).sort(filter).toArray();
            // const result = await productsCollection.find().limit(4).sort(filter).toArray();
            res.send(result)
        })

        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result)
        })

        app.get('/all-seller', async (req, res) => {
            const query = { role: 'seller' };
            const result = await usersCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/all-buyer', async (req, res) => {
            const query = { role: 'buyer' };
            const result = await usersCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/wishlist', async (req, res) => {
            const { productId, userId } = req.query;
            const query = { productId: productId, wishedById: userId };
            const result = await wishlistCollection.findOne(query);
            if (result) {
                res.send(true)
            } else {
                res.send(false)
            }
        })

        app.get('/wishlist/:email', async (req, res) => {
            const email = req.params.email;
            const query = { wishedByEmail: email };
            const result = await wishlistCollection.find(query).toArray();
            res.send(result)
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
                res.send({ accessToken: token });
            } else {
                res.status(403).send({ 'message': "Unauthorized Access" })
            }
        })

        app.post('/book-product', async (req, res) => {
            const product = req.body;
            const query = { productId: product.productId, bookedById: product.bookedById };
            const result = await bookedCollection.findOne(query);
            if (result) {
                return res.send({ message: 'Product is already booked!' })
            } else {
                const result = await bookedCollection.insertOne(product);
                return res.send(result)
            }
        })

        app.post('/user', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const result = await usersCollection.findOne(query);

            if (result) {
                return res.send(result)
            } else {
                const role = user.role || 'buyer';
                const verified = false;
                const newUser = { displayName: user.displayName, email: user.email, photoURL: user.photoURL, role: role, verified };
                const addUser = await usersCollection.insertOne(newUser);
                return res.send(addUser);
            }
        })

        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            return res.send(result)
        })

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post('/wishlist', async (req, res) => {
            const product = req.body;
            const result = await wishlistCollection.insertOne(product);
            res.send(result)
        })

        app.put('/products/advertise/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const product = req.body;
            const option = { upsert: true };
            const updateUser = {
                $set: {
                    advertise: !product.advertise
                }
            }
            const result = await productsCollection.updateOne(filter, updateUser, option);
            res.send(result);
        })

        app.put('/user/verified/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const option = { upsert: true };
            const updateUser = {
                $set: {
                    verified: true
                }
            }
            const result = await usersCollection.updateOne(filter, updateUser, option);
            res.send(result);
        })

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(query);
            res.send(result)
        })

        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })

    }
    finally {

    }
}

run().catch(err => console.log(err))

app.get('/', (req, res) => {
    res.send(`Welcome to Assignment-12, ${process.env.NAME}`);
});

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
})