const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const port = process.env.PORT || 8000;
const uri = process.env.DB_URI;

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    const usersCollection = client.db('jobtas1').collection('users');
    const tasksCollection = client.db('jobtas1').collection('tasks');


    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      console.log('I need a new jwt', user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // Save or modify user email, status in DB
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const isExist = await usersCollection.findOne(query)
      console.log('User found?----->', isExist)
      if (isExist) return res.send(isExist)
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      )
      res.send(result)
    });
    // users
    app.get('/users', verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result);
    })
    // Save task
    app.post('/tasks', verifyToken, async (req, res) => {
      const task = req.body;
      const result = await tasksCollection.insertOne(task);
      res.send(result);
    });

    // Get tasks
    app.get('/tasks', verifyToken, async (req, res) => {
      const result = await tasksCollection.find().toArray();
      res.send(result);
    });
    // Delete task
    app.delete('/tasks/:taskId', verifyToken, async (req, res) => {
      const taskId = req.params.taskId;

      try {
        const result = await tasksCollection.deleteOne({ _id: ObjectId(taskId) });
        if (result.deletedCount === 1) {
          res.send({ success: true, message: 'Task deleted successfully' });
        } else {
          res.status(404).send({ success: false, message: 'Task not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: 'Internal server error' });
      }
    });


    // Send a ping to confirm a successful connection
    /* await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment.You successfully connected to MongoDB!'
    ) */
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from icu Server..')
})

app.listen(port, () => {
  console.log(`icu is running on port ${port}`)
})
